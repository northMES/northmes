import type { RoutingOperationInput } from "@mes/contracts";
import { routingOperationInputSchema } from "@mes/contracts";
import { describe, expect, it } from "vitest";
import {
  effectiveStopThresholds,
  overrideDivergence,
  propagatedOverride,
  targetCycleSecondsOf,
} from "./operation-rules.js";

function operationInput(
  overrides: Partial<Record<string, unknown>> = {},
): RoutingOperationInput {
  return routingOperationInputSchema.parse({
    sequence: 10,
    name: "Press",
    ...overrides,
  });
}

describe("targetCycleSecondsOf", () => {
  it("takes the target cycle in seconds as given", () => {
    expect(
      targetCycleSecondsOf(operationInput({ targetCycle: { seconds: 10 } })),
    ).toBe(10);
  });

  it("converts a rate to seconds, so 440 an hour is 8.181818 s", () => {
    expect(
      targetCycleSecondsOf(
        operationInput({ targetCycle: { piecesPerHour: 440 } }),
      ),
    ).toBe(8.181818);
  });

  it("falls back to the deprecated standard run time, converted to seconds", () => {
    expect(
      targetCycleSecondsOf(
        operationInput({ standardRunPerUnit: { value: 2, unit: "MINUTE" } }),
      ),
    ).toBe(120);
  });

  it("prefers the target cycle over the deprecated spelling", () => {
    expect(
      targetCycleSecondsOf(
        operationInput({
          targetCycle: { seconds: 10 },
          standardRunPerUnit: { value: 45, unit: "SECOND" },
        }),
      ),
    ).toBe(10);
  });

  it("is zero when the step states no cycle at all", () => {
    expect(targetCycleSecondsOf(operationInput())).toBe(0);
  });
});

describe("effectiveStopThresholds", () => {
  it("marks the target cycle up when the step states no stop threshold", () => {
    expect(
      effectiveStopThresholds(
        operationInput({ targetCycle: { piecesPerHour: 440 } }),
        50,
      ),
    ).toEqual({
      stopThresholdSeconds: 12.272727,
      shortStopThresholdSeconds: null,
    });
  });

  it("keeps a stated threshold, converted to canonical seconds", () => {
    expect(
      effectiveStopThresholds(
        operationInput({
          targetCycle: { seconds: 10 },
          stopThreshold: { value: 1, unit: "MINUTE" },
          shortStopThreshold: { value: 12, unit: "SECOND" },
        }),
        50,
      ),
    ).toEqual({
      stopThresholdSeconds: 60,
      shortStopThresholdSeconds: 12,
    });
  });

  it("leaves the threshold unset when there is no cycle to mark up", () => {
    expect(effectiveStopThresholds(operationInput(), 50)).toEqual({
      stopThresholdSeconds: null,
      shortStopThresholdSeconds: null,
    });
  });

  it("takes the markup from the setting, so zero percent is the cycle itself", () => {
    expect(
      effectiveStopThresholds(
        operationInput({ targetCycle: { seconds: 10 } }),
        0,
      ).stopThresholdSeconds,
    ).toBe(10);
  });
});

const operation = {
  sequence: 20,
  standardSetupSeconds: 1800,
  standardRunSecondsPerUnit: 10,
  partsPerCycle: 1,
  stopThresholdSeconds: 15,
  shortStopThresholdSeconds: null,
};

const override = {
  resourceId: "res_cnc01",
  cycleSeconds: null,
  setupSeconds: null,
  partsPerCycle: null,
  stopThresholdSeconds: null,
  shortStopThresholdSeconds: null,
  doNotUpdate: false,
};

describe("overrideDivergence", () => {
  it("says nothing about an override that states no value of its own", () => {
    expect(overrideDivergence(operation, [override])).toEqual([]);
  });

  it("says nothing about an override that repeats the operation's value", () => {
    expect(
      overrideDivergence(operation, [
        { ...override, cycleSeconds: 10, stopThresholdSeconds: 15 },
      ]),
    ).toEqual([]);
  });

  it("names every field the override keeps apart, with the step it sits on", () => {
    expect(
      overrideDivergence(operation, [
        { ...override, cycleSeconds: 12, stopThresholdSeconds: 18 },
      ]),
    ).toEqual([
      {
        operationSequence: 20,
        resourceId: "res_cnc01",
        fields: ["cycleSeconds", "stopThresholdSeconds"],
        held: false,
      },
    ]);
  });

  it("marks a doNotUpdate row held, so the prompt can say it stays", () => {
    expect(
      overrideDivergence(operation, [
        { ...override, cycleSeconds: 12, doNotUpdate: true },
      ]),
    ).toEqual([
      {
        operationSequence: 20,
        resourceId: "res_cnc01",
        fields: ["cycleSeconds"],
        held: true,
      },
    ]);
  });

  it("counts a stated value against an operation value that is absent", () => {
    expect(
      overrideDivergence(operation, [
        { ...override, shortStopThresholdSeconds: 3 },
      ])[0]?.fields,
    ).toEqual(["shortStopThresholdSeconds"]);
  });

  it("reads a whole set of overrides in one pass", () => {
    const divergences = overrideDivergence(operation, [
      { ...override, cycleSeconds: 12 },
      { ...override, resourceId: "res_cnc02", cycleSeconds: 9 },
      { ...override, resourceId: "res_cnc03" },
    ]);

    expect(divergences.map((row) => row.resourceId)).toEqual([
      "res_cnc01",
      "res_cnc02",
    ]);
  });
});

describe("propagatedOverride", () => {
  it("writes the operation's value into every column the override states", () => {
    expect(
      propagatedOverride(operation, {
        ...override,
        cycleSeconds: 12,
        setupSeconds: 900,
        partsPerCycle: 2,
      }),
    ).toEqual({
      cycleSeconds: 10,
      setupSeconds: 1800,
      partsPerCycle: 1,
      stopThresholdSeconds: null,
      shortStopThresholdSeconds: null,
    });
  });

  it("leaves an unstated column unstated, because it already inherits", () => {
    expect(
      propagatedOverride(operation, { ...override, cycleSeconds: 12 }),
    ).toEqual({
      cycleSeconds: 10,
      setupSeconds: null,
      partsPerCycle: null,
      stopThresholdSeconds: null,
      shortStopThresholdSeconds: null,
    });
  });

  it("clears every difference it wrote", () => {
    const propagated = propagatedOverride(operation, {
      ...override,
      cycleSeconds: 12,
      stopThresholdSeconds: 18,
    });

    expect(
      overrideDivergence(operation, [{ ...override, ...propagated }]),
    ).toEqual([]);
  });

  it("answers null for a held override, which nothing rewrites", () => {
    expect(
      propagatedOverride(operation, {
        ...override,
        cycleSeconds: 12,
        doNotUpdate: true,
      }),
    ).toBeNull();
  });
});
