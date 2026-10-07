// Embedded Hive Gateway with in-process subgraph executors (role "all", one port).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execute, parse } from "graphql";
import { boot, collect, sleep, wsClient } from "./helpers.mjs";

let ctx;
beforeAll(async () => {
  ctx = await boot({ SPIKE_PLUGINS: "hello" });
});
afterAll(async () => {
  await ctx.app.close();
});

const CROSS = `{ planningProductionOrders { edges { node { number article { id name openOrderCount helloGreeting } } } } }`;

describe("queries through the embedded gateway", () => {
  it("resolves one query across planning, core and the plugin", async () => {
    const r = await ctx.gql(CROSS, { sid: "sid-alice" });
    const nodes = r.data.planningProductionOrders.edges.map((e) => e.node);
    expect(nodes[0]).toEqual({ number: "4101", article: { id: "a1", name: "Table top", openOrderCount: 1, helloGreeting: "Hello, Table top (a1)" } });
    // po4 references an article core does not know: reference resolver returns null, the gateway nulls `article`.
    expect(nodes[2]).toEqual({ number: "4104", article: null });
    expect(r.errors.map((e) => e.path.join("."))).toEqual(["planningProductionOrders.edges.2.node.article.name"]);
  });

  it("resolves the principal once per client request and batches _entities into one repository call", async () => {
    const { resetSessionLookups } = await import("../dist/src/gateway/sessions.js");
    const { ArticleRepo } = await import("../dist/src/modules/core/core.module.js");
    const repo = ctx.app.get(ArticleRepo);
    resetSessionLookups();
    const before = repo.batchCalls;
    await ctx.gql(CROSS, { sid: "sid-alice" });
    const { sessionLookups } = await import("../dist/src/gateway/sessions.js");
    expect(sessionLookups).toBe(1);
    expect(repo.batchCalls - before).toBe(1);
  });

  it("runs guards on fields reached through _entities (missing permission → null field, FORBIDDEN, owner object kept)", async () => {
    const r = await ctx.gql(`{ coreArticle(id: "a1") { id name openOrderCount } }`, { sid: "sid-bob" });
    expect(r.data.coreArticle).toEqual({ id: "a1", name: "Table top", openOrderCount: null });
    expect(r.errors[0].extensions).toMatchObject({ code: "FORBIDDEN", errorCode: "core.forbidden", serviceName: "planning" });
  });

  it("rejects anonymous callers in the subgraph guard", async () => {
    const r = await ctx.gql(`{ coreArticle(id: "a1") { id } }`);
    expect(r.errors[0].extensions.code).toBe("UNAUTHENTICATED");
  });

  it("scopes data to the active plant", async () => {
    const p1 = await ctx.gql(`{ planningProductionOrders { edges { node { number } } } }`, { sid: "sid-alice", plant: "P1" });
    expect(p1.data.planningProductionOrders.edges.map((e) => e.node.number)).toEqual(["4101", "4102", "4104"]);
    const p2 = await ctx.gql(`{ planningProductionOrders { edges { node { number } } } }`, { sid: "sid-alice", plant: "P2" });
    expect(p2.errors[0].extensions.code).toBe("FORBIDDEN"); // alice has no planning permission at P2
    const carol = await ctx.gql(`{ planningProductionOrders { edges { node { number } } } }`, { sid: "sid-carol" });
    expect(carol.data.planningProductionOrders.edges.map((e) => e.node.number)).toEqual(["4103"]);
  });

  it("masks unexpected errors from in-process subgraphs", async () => {
    const r = await ctx.gql(`{ coreBoom }`);
    expect(r.errors[0].message).toBe("Unexpected error.");
    expect(JSON.stringify(r)).not.toContain("hunter2");
  });

  it("guards also run on the reference resolver when _entities is executed directly", async () => {
    const { SubgraphRegistry } = await import("../dist/src/sdk/subgraph.js");
    const schema = ctx.app.get(SubgraphRegistry).get("core").schema;
    const r = await execute({
      schema,
      document: parse(`query($r: [_Any!]!) { _entities(representations: $r) { ... on Article { name } } }`),
      variableValues: { r: [{ __typename: "Article", id: "a1" }] },
      contextValue: { principal: null, requestId: "t", loaders: new Map(), subgraph: "core" },
    });
    expect(r.errors[0].extensions.code).toBe("UNAUTHENTICATED");
  });
});

describe("subscriptions through the embedded gateway (graphql-ws end to end)", () => {
  it("delivers planningBoardChanged with fields from core, filtered by plant", async () => {
    const client = wsClient(ctx.port, "sid-alice");
    const sub = collect(client, `subscription { planningBoardChanged(plantId: "P1") { plantId kind productionOrder { number version article { name } } } }`, 1, 2500);
    await sleep(300);
    // An event at plant P2 (carol) must not reach alice's P1 subscription.
    await ctx.gql(`mutation { planningMoveProductionOrder(id: "po3") { version } }`, { sid: "sid-carol" }).catch(() => {});
    await ctx.gql(`mutation { planningMoveProductionOrder(id: "po1") { version } }`, { sid: "sid-alice" });
    await sub.done;
    await client.dispose();
    expect(sub.events).toHaveLength(1);
    expect(sub.events[0].data.planningBoardChanged).toMatchObject({ plantId: "P1", kind: "moved", productionOrder: { number: "4101", article: { name: "Table top" } } });
  });

  it("checks permission when the subscription starts", async () => {
    const client = wsClient(ctx.port, "sid-bob");
    const sub = collect(client, `subscription { planningBoardChanged(plantId: "P1") { plantId } }`, 1, 2000);
    await sub.done;
    await client.dispose();
    expect(JSON.stringify(sub.events)).toMatch(/FORBIDDEN|Missing permission/);
  });

  it("rejects a plant the user does not belong to", async () => {
    const client = wsClient(ctx.port, "sid-carol");
    const sub = collect(client, `subscription { planningBoardChanged(plantId: "P1") { plantId } }`, 1, 2000);
    await sub.done;
    await client.dispose();
    expect(JSON.stringify(sub.events)).toMatch(/FORBIDDEN|No access to plant P1|Missing permission/);
  });
});
