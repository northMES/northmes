// Same app, subgraphs served by ApolloFederationDriver on /subgraphs/<name>; the
// embedded gateway reaches them over loopback HTTP (queries) and graphql-ws (subscriptions).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { boot, collect, sleep, wsClient } from "./helpers.mjs";

let ctx;
beforeAll(async () => {
  ctx = await boot({ SUBGRAPH_MODE: "http", SPIKE_PLUGINS: "hello" });
});
afterAll(async () => {
  await ctx.app.close();
});

describe("HTTP subgraph mode", () => {
  it("resolves the cross-subgraph query with a signed principal header", async () => {
    const r = await ctx.gql(`{ coreArticle(id: "a1") { name openOrderCount helloGreeting } }`, { sid: "sid-alice" });
    expect(r.data.coreArticle).toEqual({ name: "Table top", openOrderCount: 1, helloGreeting: "Hello, Table top (a1)" });
  });

  it("leaks a plain Error message from an Apollo subgraph through the gateway", async () => {
    const r = await ctx.gql(`{ coreBoom }`);
    expect(r.errors[0].message).toContain("hunter2"); // documents the risk: subgraphs must mask
  });

  it("exposes subgraph endpoints on the public port", async () => {
    const sdl = await ctx.gql(`{ _service { sdl } }`, { path: "/subgraphs/core" });
    expect(sdl.data._service.sdl).toContain("type Article");
    const ent = await ctx.gql(`{ _entities(representations: [{ __typename: "Article", id: "a1" }]) { ... on Article { name } } }`, { path: "/subgraphs/core" });
    expect(ent.errors[0].extensions.code).toBe("UNAUTHENTICATED");
    const forged = await ctx.gql(`{ _entities(representations: [{ __typename: "Article", id: "a1" }]) { ... on Article { name } } }`, {
      path: "/subgraphs/core",
      headers: { "x-northmes-principal": "eyJwIjp7fX0.bad" },
    });
    expect(forged.errors[0].extensions.code).toBe("UNAUTHENTICATED");
  });

  it("delivers a subscription gateway → subgraph over graphql-ws", async () => {
    const client = wsClient(ctx.port, "sid-alice");
    const sub = collect(client, `subscription { planningBoardChanged(plantId: "P1") { productionOrder { number article { name } } } }`, 1, 3000);
    await sleep(400);
    await ctx.gql(`mutation { planningMoveProductionOrder(id: "po2") { version } }`, { sid: "sid-alice" });
    await sub.done;
    await client.dispose();
    expect(sub.events[0].data.planningBoardChanged.productionOrder).toEqual({ number: "4102", article: { name: "Leg" } });
  });
});
