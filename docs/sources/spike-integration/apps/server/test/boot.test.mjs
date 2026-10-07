import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { resolve } from "node:path";
import { bootProcess, configWith, fixture, gqlClient, here, startServer } from "./helpers.mjs";

const validator = resolve(here, "plugins/example-validator");

describe("role all with a drop-in plugin built outside the workspace", () => {
  let server, gql;
  beforeAll(async () => {
    server = await startServer(configWith([validator]));
    gql = gqlClient(server.port);
  });
  afterAll(() => server?.stop());

  test("boot log lists modules in dependency order, plugin last", () => {
    expect(server.out()).toMatch(/modules=core@0.1.0,planning@0.1.0,example-validator@0.1.0\(plugin\)/);
  });

  test("plugin field on planning's entity resolves through the supergraph", async () => {
    const r = await gql("{ planningProductionOrders { edges { node { number article { name } exampleValidatorBlockReason } } } }");
    const nodes = r.data.planningProductionOrders.edges.map((e) => e.node);
    expect(nodes.find((n) => n.number === "4103")).toEqual({ number: "4103", article: { name: "Table top" }, exampleValidatorBlockReason: "Quantity 1500 is above the release limit 1000" });
  });

  test("plugin validator vetoes planning's command with a typed error", async () => {
    const r = await gql('mutation { planningReleaseProductionOrder(id: "po3") { status } }');
    expect(r.errors[0].extensions).toMatchObject({ code: "PRECONDITION", errorCode: "core.command_rejected", details: { command: "planning.releaseProductionOrder", rejectedBy: "example-validator" } });
    const ok = await gql('mutation { planningReleaseProductionOrder(id: "po2") { status } }');
    expect(ok.data.planningReleaseProductionOrder.status).toBe("RELEASED");
  });

  test("web module list comes from the same manifests", async () => {
    const r = await fetch(`http://127.0.0.1:${server.port}/api/web/modules`, { headers: { cookie: "northmes_session=sid-alice" } }).then((x) => x.json());
    expect(r.modules.map((m) => m.id)).toEqual(["planning"]);
    expect(r.modules[0]).toMatchObject({ remoteName: "planning", ownsSlots: ["planning/board/side/v1"], dependsOn: ["core"] });
  });
});

describe("validator failures fail closed", () => {
  let server, gql;
  beforeAll(async () => {
    server = await startServer(configWith([fixture("slow-validator")]));
    gql = gqlClient(server.port);
  });
  afterAll(() => server?.stop());
  test("a validator that exceeds its time limit rejects the command", async () => {
    const t0 = performance.now();
    const r = await gql('mutation { planningReleaseProductionOrder(id: "po1") { status } }');
    expect(r.errors[0].message).toBe("slow-validator did not answer within 100 ms");
    expect(performance.now() - t0).toBeLessThan(1500);
    const after = await gql("{ planningProductionOrders { edges { node { id status } } } }");
    expect(after.data.planningProductionOrders.edges.find((e) => e.node.id === "po1").node.status).toBe("PLANNED");
  });
});

describe("throwing validator", () => {
  let server, gql;
  beforeAll(async () => {
    server = await startServer(configWith([fixture("throwing-validator")]));
    gql = gqlClient(server.port);
  });
  afterAll(() => server?.stop());
  test("is masked to the client and the command does not run", async () => {
    const r = await gql('mutation { planningReleaseProductionOrder(id: "po1") { status } }');
    expect(r.errors[0].message).toBe("Unexpected error.");
    expect(JSON.stringify(r)).not.toMatch(/hunter2/);
    const after = await gql("{ planningProductionOrders { edges { node { id status } } } }");
    expect(after.data.planningProductionOrders.edges.find((e) => e.node.id === "po1").node.status).toBe("PLANNED");
  });
});

describe("host-provided packages", () => {
  test("plugin that bundles Nest, graphql and the SDK fails at boot", () => {
    const r = bootProcess(configWith([resolve(here, "plugins/bundled-validator")]));
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/"ProductionOrder" defined in resolvers, but not in schema/);
  });
  test("plugin shipping its own node_modules copy of Nest fails without the resolve hook", () => {
    const r = bootProcess(configWith([resolve(here, "plugins/ownmods-validator")]), { NORTHMES_PLUGIN_HOOKS: "outside" });
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/Cannot determine a GraphQL output type for the "quantity"/);
  });
  test("the same plugin boots when the hook maps host packages for every plugin root", () => {
    const r = bootProcess(configWith([resolve(here, "plugins/ownmods-validator")]));
    expect(r.status).toBe(0);
  });
  test("plugin outside the host tree needs the hook", () => {
    const outside = resolve(here, "../../../outside-plugins/example-validator");
    expect(bootProcess(configWith([outside]), { NORTHMES_PLUGIN_HOOKS: "0" }).out).toMatch(/ERR_MODULE_NOT_FOUND.*@northmes\/sdk/);
    expect(bootProcess(configWith([outside])).status).toBe(0);
  });
});

describe("module isolation", () => {
  test("importing another module's resolver module is a named boot error", () => {
    const r = bootProcess(configWith([]), { SPIKE_PLANNING_IMPORTS: "core-graphql" });
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/planning imports CoreModule from core, which holds resolvers; import core's API module instead/);
  });
});
