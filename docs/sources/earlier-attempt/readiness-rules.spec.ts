import type { WorkOrderOperationReadinessKind } from "@mes/contracts";
import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import {
  operationReadiness,
  type ReadinessInputs,
  type ReadinessMaterialLine,
  type ReadinessPredecessor,
} from "./readiness-rules.js";

const NOW = DateTime.fromISO("2026-09-10T12:00:00.000Z", { zone: "utc" });

const inputs = (over: Partial<ReadinessInputs> = {}): ReadinessInputs => ({
  workOrderOperationId: "op_20",
  operation: {
    sequence: 20,
    state: "PENDING",
    leadTimeSeconds: 0,
    plannedStartAt: null,
  },
  predecessor: null,
  materialLines: [],
  ...over,
});

const predecessor = (
  over: Partial<ReadinessPredecessor> = {},
): ReadinessPredecessor => ({
  sequence: 10,
  state: "RUNNING",
  quantityCompleted: 0,
  sendAheadQuantity: null,
  completedAt: null,
  sendAheadReachedAt: null,
  ...over,
});

const line = (
  over: Partial<ReadinessMaterialLine> = {},
): ReadinessMaterialLine => ({
  materialId: "mat_steel",
  quantityRequired: 100,
  quantityConsumed: 0,
  available: 500,
  ...over,
});

const checkOf = (
  readiness: ReturnType<typeof operationReadiness>,
  kind: WorkOrderOperationReadinessKind,
) => readiness.checks.find((entry) => entry.kind === kind);

describe("the predecessor check", () => {
  it("passes on the first step of the order", () => {
    const readiness = operationReadiness(inputs(), NOW);
    expect(readiness.ready).toBe(true);
    expect(checkOf(readiness, "PREDECESSOR")).toMatchObject({
      ready: true,
      message: "This is the first step of the order.",
    });
  });

  it("passes when the step before it is complete", () => {
    const readiness = operationReadiness(
      inputs({ predecessor: predecessor({ state: "COMPLETED" }) }),
      NOW,
    );
    expect(checkOf(readiness, "PREDECESSOR")).toMatchObject({
      ready: true,
      message: "Operation 10 is complete.",
    });
  });

  it("passes on a reached send-ahead count and names it", () => {
    const readiness = operationReadiness(
      inputs({
        predecessor: predecessor({
          sendAheadQuantity: 50,
          quantityCompleted: 60,
        }),
      }),
      NOW,
    );
    expect(checkOf(readiness, "PREDECESSOR")).toMatchObject({ ready: true });
    expect(checkOf(readiness, "PREDECESSOR")?.message).toContain(
      "send-ahead count of 50",
    );
  });

  it("counts the send-ahead reached once the instant is stamped", () => {
    const readiness = operationReadiness(
      inputs({
        predecessor: predecessor({
          sendAheadQuantity: 50,
          quantityCompleted: 0,
          sendAheadReachedAt: new Date("2026-09-10T09:00:00.000Z"),
        }),
      }),
      NOW,
    );
    expect(checkOf(readiness, "PREDECESSOR")?.ready).toBe(true);
  });

  it("says how far the send-ahead count still is", () => {
    const readiness = operationReadiness(
      inputs({
        predecessor: predecessor({
          sendAheadQuantity: 50,
          quantityCompleted: 12,
        }),
      }),
      NOW,
    );
    expect(readiness.ready).toBe(false);
    expect(checkOf(readiness, "PREDECESSOR")?.message).toBe(
      "Operation 10 has 12 of the 50 it sends ahead.",
    );
  });

  it("names the predecessor's state when it sends nothing ahead", () => {
    const readiness = operationReadiness(
      inputs({ predecessor: predecessor({ state: "PAUSED" }) }),
      NOW,
    );
    expect(checkOf(readiness, "PREDECESSOR")?.message).toBe(
      "Operation 10 is PAUSED, not complete.",
    );
  });

  it("ignores a send-ahead count of zero", () => {
    const readiness = operationReadiness(
      inputs({
        predecessor: predecessor({
          sendAheadQuantity: 0,
          quantityCompleted: 5,
        }),
      }),
      NOW,
    );
    expect(checkOf(readiness, "PREDECESSOR")?.ready).toBe(false);
  });
});

describe("the lead time check", () => {
  const waiting = {
    sequence: 20,
    state: "PENDING" as const,
    plannedStartAt: null,
  };

  it("passes when the step has none", () => {
    expect(
      checkOf(operationReadiness(inputs(), NOW), "LEAD_TIME"),
    ).toMatchObject({
      ready: true,
      readyAt: null,
    });
  });

  it("passes when there is no predecessor to count from", () => {
    const readiness = operationReadiness(
      inputs({ operation: { ...waiting, leadTimeSeconds: 3600 } }),
      NOW,
    );
    expect(checkOf(readiness, "LEAD_TIME")?.ready).toBe(true);
  });

  it("counts from the predecessor's completion and names the instant", () => {
    const readiness = operationReadiness(
      inputs({
        operation: { ...waiting, leadTimeSeconds: 7200 },
        predecessor: predecessor({
          state: "COMPLETED",
          completedAt: new Date("2026-09-10T11:00:00.000Z"),
        }),
      }),
      NOW,
    );
    const check = checkOf(readiness, "LEAD_TIME");
    expect(check?.ready).toBe(false);
    expect(check?.readyAt).toBe("2026-09-10T13:00:00.000Z");
  });

  it("counts from the send-ahead instant when the predecessor has not finished", () => {
    const readiness = operationReadiness(
      inputs({
        operation: { ...waiting, leadTimeSeconds: 3600 },
        predecessor: predecessor({
          state: "RUNNING",
          sendAheadQuantity: 50,
          quantityCompleted: 60,
          sendAheadReachedAt: new Date("2026-09-10T10:30:00.000Z"),
        }),
      }),
      NOW,
    );
    const check = checkOf(readiness, "LEAD_TIME");
    expect(check?.readyAt).toBe("2026-09-10T11:30:00.000Z");
    expect(check?.ready).toBe(true);
    expect(readiness.ready).toBe(true);
  });

  it("has no instant while the predecessor has neither", () => {
    const readiness = operationReadiness(
      inputs({
        operation: { ...waiting, leadTimeSeconds: 3600 },
        predecessor: predecessor({ state: "RUNNING" }),
      }),
      NOW,
    );
    expect(checkOf(readiness, "LEAD_TIME")).toMatchObject({
      ready: false,
      readyAt: null,
    });
  });

  it("is ready the moment the lead time is up", () => {
    const readiness = operationReadiness(
      inputs({
        operation: { ...waiting, leadTimeSeconds: 3600 },
        predecessor: predecessor({
          state: "COMPLETED",
          completedAt: new Date("2026-09-10T11:00:00.000Z"),
        }),
      }),
      NOW,
    );
    expect(checkOf(readiness, "LEAD_TIME")).toMatchObject({
      ready: true,
      message: "The lead time has elapsed.",
    });
  });
});

describe("the material check", () => {
  it("passes when the step consumes nothing", () => {
    expect(checkOf(operationReadiness(inputs(), NOW), "MATERIAL")?.ready).toBe(
      true,
    );
  });

  it("passes when every line is covered", () => {
    const readiness = operationReadiness(
      inputs({ materialLines: [line(), line({ materialId: "mat_wire" })] }),
      NOW,
    );
    expect(checkOf(readiness, "MATERIAL")).toMatchObject({
      ready: true,
      message: "Every material line is covered.",
    });
  });

  it("counts what is already consumed against the requirement", () => {
    const readiness = operationReadiness(
      inputs({
        materialLines: [
          line({ quantityRequired: 100, quantityConsumed: 80, available: 20 }),
        ],
      }),
      NOW,
    );
    expect(checkOf(readiness, "MATERIAL")?.ready).toBe(true);
  });

  it("names the shortfall", () => {
    const readiness = operationReadiness(
      inputs({
        materialLines: [
          line({ quantityRequired: 100, quantityConsumed: 10, available: 25 }),
        ],
      }),
      NOW,
    );
    expect(readiness.ready).toBe(false);
    expect(checkOf(readiness, "MATERIAL")?.message).toBe(
      "mat_steel is short 65",
    );
  });

  it("says plainly when a balance could not be read", () => {
    const readiness = operationReadiness(
      inputs({ materialLines: [line({ available: null })] }),
      NOW,
    );
    expect(checkOf(readiness, "MATERIAL")).toMatchObject({
      ready: false,
      message: "The stock of mat_steel could not be read.",
    });
  });
});

describe("the answer", () => {
  it("carries the step's identity and state", () => {
    const readiness = operationReadiness(
      inputs({
        operation: {
          sequence: 30,
          state: "RUNNING",
          leadTimeSeconds: 0,
          plannedStartAt: new Date("2026-09-11T06:00:00.000Z"),
        },
      }),
      NOW,
    );
    expect(readiness).toMatchObject({
      workOrderOperationId: "op_20",
      sequence: 30,
      state: "RUNNING",
      ready: true,
    });
    expect(readiness.checks).toHaveLength(3);
  });

  it("takes the current instant when none is given", () => {
    expect(operationReadiness(inputs()).ready).toBe(true);
  });
});
