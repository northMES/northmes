import type {
  OperationOverrideField,
  OperationResourceDivergence,
  RoutingOperationInput,
} from "@mes/contracts";
import {
  cycleSecondsFromInput,
  defaultStopThresholdSeconds,
  OPERATION_OVERRIDE_FIELDS,
} from "@mes/contracts";
import { canonicalUnitFromInput } from "@mes/service-common";

/*
 * The rate and override rules of a routing step (order management plan
 * O-2). Pure functions: the service hands them an input or a saved row and
 * stores what they answer, so the propagate prompt, the create path and the
 * release snapshot all read the same rule.
 */

/**
 * The planned seconds one cycle takes. `targetCycle` is the O-2 spelling and
 * accepts a rate; `standardRunPerUnit` is the pre-O-2 measured time and is
 * read only when no target cycle is stated. A step that states neither has
 * no cycle, which is zero rather than an error: a step can be pure setup.
 */
export function targetCycleSecondsOf(input: RoutingOperationInput): number {
  if (input.targetCycle !== null && input.targetCycle !== undefined) {
    return cycleSecondsFromInput(input.targetCycle);
  }

  return canonicalUnitFromInput("time", input.standardRunPerUnit) ?? 0;
}

/** The two stop thresholds a step is stored with. */
export interface StopThresholds {
  readonly stopThresholdSeconds: number | null;
  readonly shortStopThresholdSeconds: number | null;
}

/**
 * The default rule: a step that states no stop threshold gets its
 * target cycle plus the markup the platform setting names, so 50 percent
 * turns a 10 second cycle into a 15 second threshold. The short stop stays
 * unset, because a micro-stop boundary is a judgement about the machine and
 * not a fraction of the cycle.
 *
 * A step with no cycle to mark up keeps both thresholds unset. Marking zero
 * up answers zero, and a zero threshold would call every gap a stop.
 */
export function effectiveStopThresholds(
  input: RoutingOperationInput,
  markupPercent: number,
): StopThresholds {
  const stated = canonicalUnitFromInput("time", input.stopThreshold);
  const targetCycleSeconds = targetCycleSecondsOf(input);
  const stopThresholdSeconds =
    stated ??
    (targetCycleSeconds > 0
      ? defaultStopThresholdSeconds(targetCycleSeconds, markupPercent)
      : null);

  return {
    stopThresholdSeconds,
    shortStopThresholdSeconds: canonicalUnitFromInput(
      "time",
      input.shortStopThreshold,
    ),
  };
}

/** The five columns an override may keep apart from its operation. */
export type OperationOverrideValues = {
  readonly [Field in OperationOverrideField]: number | null;
};

/** One saved override row, as the divergence rules read it. */
export interface OperationOverrideRow extends OperationOverrideValues {
  readonly resourceId: string;
  /** Held: neither an import nor the propagate prompt rewrites this row. */
  readonly doNotUpdate: boolean;
}

/** The operation's own values, under the names the override columns carry. */
export interface OperationOverrideSource {
  readonly sequence: number;
  readonly standardSetupSeconds: number;
  readonly standardRunSecondsPerUnit: number;
  readonly partsPerCycle: number;
  readonly stopThresholdSeconds: number | null;
  readonly shortStopThresholdSeconds: number | null;
}

/** What the operation says for one override field. */
function operationValueOf(
  operation: OperationOverrideSource,
  field: OperationOverrideField,
): number | null {
  switch (field) {
    case "cycleSeconds":
      return operation.standardRunSecondsPerUnit;
    case "setupSeconds":
      return operation.standardSetupSeconds;
    case "partsPerCycle":
      return operation.partsPerCycle;
    case "stopThresholdSeconds":
      return operation.stopThresholdSeconds;
    case "shortStopThresholdSeconds":
      return operation.shortStopThresholdSeconds;
  }
}

/** The fields one override keeps apart from its operation, in schema order. */
function divergentFields(
  operation: OperationOverrideSource,
  override: OperationOverrideValues,
): OperationOverrideField[] {
  return OPERATION_OVERRIDE_FIELDS.filter((field) => {
    const stated = override[field];

    return stated !== null && stated !== operationValueOf(operation, field);
  });
}

/**
 * Which resources now run the step differently, the answer the propagate
 * prompt shows (O-2). A null column is not a difference: it means the
 * operation's value applies on that resource, which is what propagating
 * would leave behind anyway.
 */
export function overrideDivergence(
  operation: OperationOverrideSource,
  overrides: readonly OperationOverrideRow[],
): OperationResourceDivergence[] {
  const divergences: OperationResourceDivergence[] = [];
  for (const override of overrides) {
    const fields = divergentFields(operation, override);
    if (fields.length === 0) continue;
    divergences.push({
      operationSequence: operation.sequence,
      resourceId: override.resourceId,
      fields,
      held: override.doNotUpdate,
    });
  }

  return divergences;
}

/**
 * The override's columns after the planner accepts the prompt: every column
 * the row states takes the operation's value, and a column the row leaves
 * unstated stays unstated, because it already inherits. A held row answers
 * null, because nothing rewrites it.
 */
export function propagatedOverride(
  operation: OperationOverrideSource,
  override: OperationOverrideRow,
): OperationOverrideValues | null {
  if (override.doNotUpdate) return null;

  return Object.fromEntries(
    OPERATION_OVERRIDE_FIELDS.map((field) => [
      field,
      override[field] === null ? null : operationValueOf(operation, field),
    ]),
  ) as OperationOverrideValues;
}
