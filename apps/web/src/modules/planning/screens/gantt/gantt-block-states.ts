// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatDuration, formatPlantDateTime, formatSpan } from '@northmes/contracts/format';
import type { GanttSnapshot } from '../../gantt-data.ts';
import type { MaterialShortage } from '../../material-projection.ts';
import { quantityWithUnit } from '../../stock-facts.ts';
import { workingMsBetween } from '../../timeline/availability-shading.ts';
import {
  type JobOrderRow,
  latenessText,
  quantityText,
  savedSetupOf,
  statusLabel,
} from './gantt-rows.ts';

/**
 * "setup 30 min" or, for a retool a run saves (ADR 0083 rule 4), the setup that remains (the fixed
 * time) and the saved retool: "setup 0 min, retool saved by the run (30 min)".
 */
export function setupText(row: JobOrderRow, snapshot: GanttSnapshot): string {
  const saved = savedSetupOf(snapshot, row.jobOrder.id);
  const setup = `setup ${formatDuration(row.jobOrder.plannedSetupS)}`;
  return saved === undefined
    ? setup
    : `${setup}, retool saved by the run (${formatDuration(saved.setupS)})`;
}

/** A state cue of a block (plan 07, Block states): its kind and the words the name carries. */
export interface BlockState {
  readonly kind: 'locked' | 'conflict' | 'late' | 'chain' | 'draft' | 'material';
  readonly text: string;
}

/** The conflict codes a broken constraint line reports on a block's edge. */
const conflictCodes = new Set(['LEAD_TIME', 'SEND_AHEAD', 'LAST_PIECE', 'OVERLAP', 'CLOSED_TIME']);

/**
 * The relation of a row to its release (plan 18, Blocks, links and the selection): "released from
 * 1003.10 at Wed 4 Nov 12:45, starts on time", or, when the row starts before its release, "starts
 * 45 minutes before its release from 1003.10". None for a first operation.
 */
export function releaseText(
  row: JobOrderRow,
  timeZone: string,
  retoolOverlapsLeadTime: boolean,
): string | undefined {
  const release = row.analysis?.release;
  const placement = row.jobOrder.placement;
  if (release === undefined || placement === undefined) return undefined;
  const boundStart = retoolOverlapsLeadTime ? placement.runStartMs : placement.setupStartMs;
  if (boundStart < release.atMs) {
    const early = formatDuration((release.atMs - boundStart) / 1000, { style: 'long' });
    return `starts ${early} before its release from ${release.fromRow}`;
  }
  return `released from ${release.fromRow} at ${formatPlantDateTime(release.atMs, timeZone)}, starts on time`;
}

/** Whether the row starts before its release, which draws the link in the conflict style. */
export function startsBeforeRelease(row: JobOrderRow, retoolOverlapsLeadTime: boolean): boolean {
  const release = row.analysis?.release;
  const placement = row.jobOrder.placement;
  if (release === undefined || placement === undefined) return false;
  return (retoolOverlapsLeadTime ? placement.runStartMs : placement.setupStartMs) < release.atMs;
}

/** The states of a block besides its order color, each with the words its name carries. */
export function blockStates(
  row: JobOrderRow,
  snapshot: GanttSnapshot,
  options: BlockStateOptions = {},
): BlockState[] {
  const states: BlockState[] = [];
  if (row.operation.isLocked) states.push({ kind: 'locked', text: 'locked' });
  if (options.inDraft) states.push({ kind: 'draft', text: 'changed in your draft, not saved' });
  const broken = row.analysis?.constraints.filter(
    (line) => !line.holds && line.code !== undefined && conflictCodes.has(line.code),
  );
  for (const line of broken ?? []) {
    if (line.code === 'LEAD_TIME' || line.code === 'SEND_AHEAD') {
      const text = releaseText(
        row,
        snapshot.plant.timeZone,
        snapshot.settings.retoolOverlapsLeadTime,
      );
      if (text !== undefined) states.push({ kind: 'conflict', text });
    } else if (line.code === 'OVERLAP') {
      states.push({ kind: 'conflict', text: `overlaps ${line.involves?.join(', ') ?? ''}` });
    } else if (line.code === 'LAST_PIECE') {
      states.push({
        kind: 'conflict',
        text: `ends before the last piece of ${line.involves?.join(', ') ?? ''}`,
      });
    } else {
      states.push({ kind: 'conflict', text: 'work in closed time' });
    }
  }
  const orderAnalysis = snapshot.analysis.orders[row.order.id];
  if (orderAnalysis?.late) states.push({ kind: 'late', text: latenessText(orderAnalysis) });
  if (options.onChain) states.push({ kind: 'chain', text: 'on the critical chain' });
  for (const shortage of options.material ?? []) {
    states.push({ kind: 'material', text: `material short: ${materialShortText(shortage)}` });
  }
  return states;
}

/**
 * When a shortage bites, from where its consumption is dated: "at setup start", "now, its setup
 * start has passed" for a consumption counted at now, "at the order deadline" for one not placed.
 */
export function shortWhenText(shortage: MaterialShortage): string {
  const { dateFrom } = shortage.movement;
  if (dateFrom === 'Now, overdue') return 'now, its setup start has passed';
  if (dateFrom === 'Order deadline') return 'at the order deadline';
  return 'at setup start';
}

/** "Round bar 36 C45, 26 m short at setup start": the material warning of a job order in words. */
export function materialShortText(shortage: MaterialShortage, separator = ', '): string {
  return `${shortage.material.name}${separator}${quantityWithUnit(shortage.shortfall, shortage.material.unit)} short ${shortWhenText(shortage)}`;
}

/** What a block's states read besides the row: the chain, the draft and the material warning. */
export interface BlockStateOptions {
  readonly onChain?: boolean;
  readonly inDraft?: boolean;
  /** The shortages of the row's operation, none while its material holds. */
  readonly material?: readonly MaterialShortage[];
}

/** The working and the elapsed time of a placed row, each with its word (ADR 0061, plan 18). */
export function durationsOf(
  row: JobOrderRow,
  snapshot: GanttSnapshot,
): { readonly working: string; readonly elapsed: string } | undefined {
  const placement = row.jobOrder.placement;
  if (placement === undefined) return undefined;
  const workingS =
    placement.segments.length > 0
      ? placement.segments.reduce((sum, segment) => sum + (segment.toMs - segment.fromMs), 0) / 1000
      : workingMsBetween(
          snapshot.calendar,
          snapshot.plant.timeZone,
          placement.setupStartMs,
          placement.endMs,
        ) / 1000;
  const elapsedS = (placement.endMs - placement.setupStartMs) / 1000;
  return {
    working: `${formatDuration(workingS, { form: 'hours' })} working`,
    elapsed: `${formatDuration(elapsedS, { form: 'hours' })} elapsed`,
  };
}

/**
 * The accessible name of a block (plan 07, Block states): the row, the article, the quantity, the
 * machine, the times, the setup and run durations, the status, the release relation, the words of
 * the block fields the name does not already say (#762) and every state cue in words, so a screen
 * reader hears what the block shows and the hover card adds.
 */
export function blockName(
  row: JobOrderRow,
  snapshot: GanttSnapshot,
  machineName: string,
  options: BlockStateOptions & { readonly extraNames?: readonly string[] } = {},
): string {
  const { jobOrder, operation, order } = row;
  const timeZone = snapshot.plant.timeZone;
  // A row whose placement comes with a time chunk not loaded yet is placed, its time unknown.
  const span =
    jobOrder.placement !== undefined
      ? formatSpan(jobOrder.placement.setupStartMs, jobOrder.placement.endMs, timeZone)
      : jobOrder.awaitingPlacement === true
        ? 'time loading'
        : 'not placed';
  const states = blockStates(row, snapshot, options);
  const release = releaseText(row, timeZone, snapshot.settings.retoolOverlapsLeadTime);
  return [
    `${operation.displayNumber} ${operation.name}`,
    order.article,
    quantityText(jobOrder.quantity),
    machineName,
    span,
    `${setupText(row, snapshot)}, run ${formatDuration(jobOrder.plannedRunS)}`,
    statusLabel(jobOrder.status).toLowerCase(),
    ...(release !== undefined && !states.some((state) => state.kind === 'conflict')
      ? [release]
      : []),
    ...(options.extraNames ?? []),
    ...states.map((state) => state.text),
  ].join(', ');
}
