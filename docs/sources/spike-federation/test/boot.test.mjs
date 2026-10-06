// Boot behavior: compose at boot from enabled modules, and failure modes.
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { freePort } from "./helpers.mjs";

function run(env) {
  const r = spawnSync(process.execPath, ["dist/src/main.js"], {
    env: { ...process.env, PORT: String(freePort()), SPIKE_EXIT_AFTER_BOOT: "1", ...env },
    encoding: "utf8",
    timeout: 30_000,
  });
  return { code: r.status, out: r.stdout + r.stderr };
}

describe("boot", () => {
  it("boots core + planning and composes at boot (plugin off)", () => {
    const r = run({});
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/subgraphs=core,planning/);
    expect(r.out).toMatch(/supergraph has Article.helloGreeting=false/);
  });

  it("a plugin enabled by configuration joins the supergraph without a rebuild", () => {
    const r = run({ SPIKE_PLUGINS: "hello" });
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/subgraphs=core,hello,planning/);
    expect(r.out).toMatch(/supergraph has Article.helloGreeting=true/);
  });

  it("a composition error stops boot with one readable message and exit code 1", () => {
    const r = run({ SPIKE_PLUGINS: "broken" });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/SupergraphCompositionError: Supergraph composition failed \(3 errors\)/);
    expect(r.out).toMatch(/NORTHMES_ROOT_FIELD_PREFIX\] \[broken\] Query.ping/);
    expect(r.out).toMatch(/FIELD_TYPE_MISMATCH\] Type of field "Article.name"/);
  });

  it("without the include workaround, registerIn is ignored under the federation driver", () => {
    const r = run({ SPIKE_NO_INCLUDE_WORKAROUND: "1" });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/multiple types named "Article"/);
  });

  it("with Nest's default federation link (v2.14) composition fails", () => {
    const r = run({ SPIKE_DEFAULT_LINK: "1" });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/UNKNOWN_FEDERATION_LINK_VERSION/);
  });

  it("a non-null field contributed to another module's entity stops boot", () => {
    const r = run({ SPIKE_NONNULL_CONTRIBUTED: "1" });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/NORTHMES_CONTRIBUTED_FIELD_NULLABLE\] \[planning\] Article.openOrderCount/);
  });

  it("the same app boots in HTTP subgraph mode (Apollo per subgraph)", () => {
    const r = run({ SUBGRAPH_MODE: "http", SPIKE_PLUGINS: "hello" });
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/subgraphs=core,hello,planning/);
  });
});
