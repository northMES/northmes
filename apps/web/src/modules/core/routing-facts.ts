// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatDuration } from '@northmes/contracts/format';
import type { RoutingOperation } from './routings-data.ts';

/** Where an input of the planned duration comes from (ADR 0027). */
export type DurationSource = 'Operation' | 'Machine' | 'Tool' | 'Plant setting';

export interface DurationInput {
  readonly label: string;
  readonly value: number;
  readonly source: DurationSource;
}

/** The planned duration of a quantity on a machine with a tool, and every input it read. */
export interface PlannedDuration {
  readonly inputs: readonly DurationInput[];
  readonly setupS: number;
  readonly cycles: number;
  readonly runS: number;
  readonly totalS: number;
}

/**
 * The planned duration of an operation (plan 07, Planned duration; ADR 0027): a tool's pieces per
 * cycle wins over the machine's, the machine's over the operation's; the machine's cycle time,
 * cycles per piece and retool over the operation's. Setup is retool plus fixed time; run is
 * ceil(quantity × cycles per piece ÷ pieces per cycle) cycles of the cycle time, divided by the
 * planning factor, 1 while the plant's planning factor source is none.
 */
export function plannedDuration(
  operation: RoutingOperation,
  machineCode: string,
  toolCode: string | undefined,
  quantity: number,
  planningFactor = 1,
): PlannedDuration {
  const machine = operation.machines.find((each) => each.code === machineCode);
  const tool = operation.tools.find((each) => each.code === toolCode);
  const pick = (
    label: string,
    operationValue: number,
    machineValue: number | undefined,
    toolValue?: number,
  ): DurationInput =>
    toolValue !== undefined
      ? { label, value: toolValue, source: 'Tool' }
      : machineValue !== undefined
        ? { label, value: machineValue, source: 'Machine' }
        : { label, value: operationValue, source: 'Operation' };
  const cycle = pick('Cycle time', operation.cycleSeconds, machine?.cycleSeconds);
  const pieces = pick(
    'Pieces per cycle',
    operation.piecesPerCycle,
    machine?.piecesPerCycle,
    tool?.piecesPerCycle,
  );
  const perPiece = pick('Cycles per piece', operation.cyclesPerPiece, machine?.cyclesPerPiece);
  const retool = pick('Retool', operation.retoolSeconds, machine?.retoolSeconds);
  const fixed: DurationInput = {
    label: 'Fixed time',
    value: operation.fixedSeconds,
    source: 'Operation',
  };
  const factor: DurationInput = {
    label: 'Planning factor',
    value: planningFactor,
    source: 'Plant setting',
  };
  const setupS = retool.value + fixed.value;
  const cycles = Math.ceil((quantity * perPiece.value) / pieces.value);
  const runS = (cycles * cycle.value) / factor.value;
  return {
    inputs: [cycle, pieces, perPiece, retool, fixed, factor],
    setupS,
    cycles,
    runS,
    totalS: setupS + runS,
  };
}

/** "30 s": a cycle time. */
export function secondsText(seconds: number): string {
  return `${seconds} s`;
}

/** "30 min", "1 h" or "0": a retool, fixed or lead time, zero written as a plain 0. */
export function timeOrZero(seconds: number): string {
  return seconds === 0 ? '0' : formatDuration(seconds, { form: 'hours' });
}

/** "1 h" or "None": a lead time or send-ahead that is often absent. */
export function timeOrNone(seconds: number): string {
  return seconds === 0 ? 'None' : formatDuration(seconds, { form: 'hours' });
}

/** "85 %": an OEE target. */
export function percentText(ratio: number): string {
  return `${Math.round(ratio * 100)} %`;
}

/** "entered as 120 pcs/h": how a cycle time was entered, when it was not in seconds. */
export function enteredText(operation: RoutingOperation): string | undefined {
  return operation.cycleEntered.unit === 'piecesPerHour'
    ? `entered as ${operation.cycleEntered.value} pcs/h`
    : undefined;
}

/** The source of an operation's values as its tag shows it. */
export function operationSourceKind(operation: RoutingOperation): 'erp' | 'kept' {
  return operation.kept === undefined ? 'erp' : 'kept';
}

/** Why Save operation, Take the ERP's values and Create routing wait for the API. */
export const routingActionReason =
  'Changes to routings wait for the routing API; these pages read the fixture G1.';
