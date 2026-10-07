import type {
  WorkOrderOperationReadiness,
  WorkOrderOperationReadinessCheck,
  WorkOrderOperationState,
} from "@mes/contracts";
import { DateTime } from "luxon";

/*
 * What stands between a step and the floor picking it up (O-3). Three named
 * checks rather than one flag, so a screen and the terminal say what is in
 * the way: the step before it, the waiting time after that step, and the
 * material it consumes.
 *
 * Pure: every input is read for the caller and handed in, and `now` is an
 * argument, so a spec can put a lead time half elapsed and assert the
 * instant the step turns ready.
 */

/** The step being judged. */
export interface ReadinessOperation {
  readonly sequence: number;
  readonly state: WorkOrderOperationState;
  /** Waiting time after the predecessor, canonical seconds. */
  readonly leadTimeSeconds: number;
  readonly plannedStartAt: Date | null;
}

/**
 * The nearest lower-sequence step that is not skipped, or null when this is
 * the first. `sendAheadReachedAt` is the instant its send-ahead count was
 * reached, which is what the lead time counts from when the step itself has
 * not finished.
 */
export interface ReadinessPredecessor {
  readonly sequence: number;
  readonly state: WorkOrderOperationState;
  readonly quantityCompleted: number;
  readonly sendAheadQuantity: number | null;
  readonly completedAt: Date | null;
  readonly sendAheadReachedAt: Date | null;
}

/**
 * One material line this step consumes. `available` is what traceability
 * projects at the planned start, read through the supergraph; null means the
 * read failed or the field is not in the graph yet, and the check says so
 * rather than passing on a guess.
 */
export interface ReadinessMaterialLine {
  readonly materialId: string;
  readonly quantityRequired: number;
  readonly quantityConsumed: number;
  readonly available: number | null;
}

export interface ReadinessInputs {
  readonly workOrderOperationId: string;
  readonly operation: ReadinessOperation;
  readonly predecessor: ReadinessPredecessor | null;
  readonly materialLines: readonly ReadinessMaterialLine[];
}

function check(
  kind: WorkOrderOperationReadinessCheck["kind"],
  ready: boolean,
  message: string,
  readyAt: string | null = null,
): WorkOrderOperationReadinessCheck {
  return { kind, ready, message, readyAt };
}

/** Whether the predecessor's send-ahead count has been reached. */
function sendAheadReached(predecessor: ReadinessPredecessor): boolean {
  if (predecessor.sendAheadQuantity === null) return false;
  if (predecessor.sendAheadQuantity <= 0) return false;

  return (
    predecessor.sendAheadReachedAt !== null ||
    predecessor.quantityCompleted >= predecessor.sendAheadQuantity
  );
}

/**
 * The step before this one: complete, or far enough along that the
 * send-ahead rule lets this one begin. The message names which of the two
 * answered, because "operation 20 is ready" reads differently when the step
 * before it is still running.
 */
function predecessorCheck(
  predecessor: ReadinessPredecessor | null,
): WorkOrderOperationReadinessCheck {
  if (predecessor === null) {
    return check("PREDECESSOR", true, "This is the first step of the order.");
  }
  if (predecessor.state === "COMPLETED") {
    return check(
      "PREDECESSOR",
      true,
      `Operation ${predecessor.sequence} is complete.`,
    );
  }
  if (sendAheadReached(predecessor)) {
    return check(
      "PREDECESSOR",
      true,
      `Operation ${predecessor.sequence} has reached its send-ahead count of ${predecessor.sendAheadQuantity}.`,
    );
  }
  if (
    predecessor.sendAheadQuantity !== null &&
    predecessor.sendAheadQuantity > 0
  ) {
    return check(
      "PREDECESSOR",
      false,
      `Operation ${predecessor.sequence} has ${predecessor.quantityCompleted} of the ${predecessor.sendAheadQuantity} it sends ahead.`,
    );
  }

  return check(
    "PREDECESSOR",
    false,
    `Operation ${predecessor.sequence} is ${predecessor.state}, not complete.`,
  );
}

/**
 * The waiting time on the waiting step: counted from the
 * predecessor being fully done, or from the instant its send-ahead count was
 * reached when it has not finished. While the predecessor has neither, there
 * is no instant to count from and the check answers "not yet" with no date.
 */
function leadTimeCheck(
  operation: ReadinessOperation,
  predecessor: ReadinessPredecessor | null,
  now: DateTime,
): WorkOrderOperationReadinessCheck {
  if (operation.leadTimeSeconds <= 0) {
    return check("LEAD_TIME", true, "The step has no lead time.");
  }
  if (predecessor === null) {
    return check(
      "LEAD_TIME",
      true,
      "There is no predecessor for the lead time to run from.",
    );
  }
  const from = predecessor.completedAt ?? predecessor.sendAheadReachedAt;
  if (from === null) {
    return check(
      "LEAD_TIME",
      false,
      `The lead time runs from operation ${predecessor.sequence} completing or reaching its send-ahead count, and neither has happened.`,
    );
  }
  const readyAt = DateTime.fromJSDate(from, { zone: "utc" }).plus({
    seconds: operation.leadTimeSeconds,
  });
  const ready = now >= readyAt;

  return check(
    "LEAD_TIME",
    ready,
    ready
      ? "The lead time has elapsed."
      : `The lead time elapses at ${readyAt.toISO()}.`,
    readyAt.toISO(),
  );
}

/**
 * Material: every line this step consumes has enough left. A line whose
 * balance could not be read blocks the step with that said plainly, so
 * nobody reads a green check as "the store has it".
 */
function materialCheck(
  lines: readonly ReadinessMaterialLine[],
): WorkOrderOperationReadinessCheck {
  if (lines.length === 0) {
    return check("MATERIAL", true, "The step consumes no material.");
  }
  const unread = lines.filter((line) => line.available === null);
  if (unread.length > 0) {
    return check(
      "MATERIAL",
      false,
      `The stock of ${unread.map((line) => line.materialId).join(", ")} could not be read.`,
    );
  }
  const short = lines.filter(
    (line) =>
      (line.available ?? 0) < line.quantityRequired - line.quantityConsumed,
  );
  if (short.length > 0) {
    return check(
      "MATERIAL",
      false,
      short
        .map(
          (line) =>
            `${line.materialId} is short ${round(
              line.quantityRequired -
                line.quantityConsumed -
                (line.available ?? 0),
            )}`,
        )
        .join("; "),
    );
  }

  return check("MATERIAL", true, "Every material line is covered.");
}

/** Six decimals, the precision the quantity columns carry, without the float tail. */
function round(value: number): number {
  return Number(value.toFixed(6));
}

/**
 * The three checks and the flag they add up to. A step that already runs or
 * is finished is still judged: the answer describes what stands in the way
 * now, and a screen decides whether to show it.
 */
export function operationReadiness(
  inputs: ReadinessInputs,
  now: DateTime = DateTime.utc(),
): WorkOrderOperationReadiness {
  const checks = [
    predecessorCheck(inputs.predecessor),
    leadTimeCheck(inputs.operation, inputs.predecessor, now),
    materialCheck(inputs.materialLines),
  ];

  return {
    workOrderOperationId: inputs.workOrderOperationId,
    sequence: inputs.operation.sequence,
    state: inputs.operation.state,
    ready: checks.every((entry) => entry.ready),
    checks,
  };
}
