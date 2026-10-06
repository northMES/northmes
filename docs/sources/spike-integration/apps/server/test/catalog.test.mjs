import { describe, expect, test } from "vitest";
import { moduleNames } from "@northmes/sdk";
import { bootProcess, configWith, fixture } from "./helpers.mjs";

describe("module names", () => {
  test("one kebab-case id gives every derived name", () => {
    expect(moduleNames("production-start")).toEqual({ id: "production-start", gql: "productionStart", sql: "production_start", remote: "productionStart" });
    expect(moduleNames("erp-connector").gql).toBe("erpConnector");
    expect(() => moduleNames("Planning")).toThrow(/kebab-case/);
    expect(() => moduleNames("acme_validator")).toThrow(/kebab-case/);
  });
});

describe("hard boot failures (exit 1, every problem listed)", () => {
  const cases = [
    ["bad-range", /bad-range 0.1.0 supports NorthMES >=0.2.0 <0.3.0; this installation runs 0.1.0/],
    ["missing-dep", /missing-dep depends on "quality", which is not installed/],
    ["bad-prefix", /bad-prefix: "planning.productionOrder" must start with "badPrefix."/],
    ["slot-thief", /slot-thief contributes to slot "planning\/board\/side\/v1" of planning but does not depend on it/],
    ["wrong-target", /validates "planning.rescheduleEverything", which no installed module declares as validatable/],
    ["no-depends", /validates "planning.releaseProductionOrder" of planning but does not depend on planning/],
  ];
  for (const [id, pattern] of cases) {
    test(id, () => {
      const r = bootProcess(configWith([fixture(id)]));
      expect(r.status).toBe(1);
      expect(r.out).toMatch(pattern);
    });
  }
  test("cycle", () => {
    const r = bootProcess(configWith([fixture("cycle-a"), fixture("cycle-b")]));
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/dependency cycle: cycle-a -> cycle-b -> cycle-a/);
  });
  test("several problems in one boot", () => {
    const r = bootProcess(configWith([fixture("bad-range"), fixture("missing-dep"), fixture("bad-prefix")]));
    expect(r.out).toMatch(/refused to start \(3 problems\)/);
  });
});
