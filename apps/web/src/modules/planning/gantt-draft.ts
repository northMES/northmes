// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The planner's draft on the order Gantt, in memory (plan 18, Moves on the order Gantt; Resolving
// a break in the draft): the moves a planner made, each through the domain's cascade, the snapshot
// with them applied, and the conflicts the draft creates with the actions that fit each one. The
// server's draft of ADR 0029 replaces the memory when the plan server exists; the shapes are its.
import { formatDuration, formatPlantDateTime } from '@northmes/contracts/format';
import {
  type CascadeOptions,
  type CascadeResult,
  type Conflict,
  cascade,
  combineIntoRun,
  type JobOrderSpan,
  type Move,
  type MoveReason,
  type MoveRefusal,
  type PlacedMove,
  type Run,
  type RunResult,
} from '@northmes/planning-domain';
import {
  analyzeGantt,
  type GanttSnapshotBase,
  placementWithSegments,
  planContextOf,
} from './gantt-analysis.ts';
import type { ConstraintCode, GanttOrder, GanttSnapshot } from './gantt-data.ts';

/** One draft change: a job order from its committed span to its draft span (plan 07, Drafts). */
export interface DraftChange {
  readonly jobOrderId: string;
  readonly displayNumber: string;
  readonly orderId: string;
  readonly equipment: string;
  /** The committed span; none for a row that was unplaced. */
  readonly from?: JobOrderSpan;
  readonly to: JobOrderSpan;
  readonly reason: MoveReason;
  /** The run the change belongs to; the My draft list folds such changes into the run's line. */
  readonly runId?: string;
  /** The planned setup the change sets: zero for a setup the run saves (ADR 0083). */
  readonly setupS?: number;
}

export interface GanttDraft {
  readonly changes: readonly DraftChange[];
  /** The runs the planner combined in this draft (ADR 0083). */
  readonly runs: readonly Run[];
}

export const emptyDraft: GanttDraft = { changes: [], runs: [] };

/** A conflict the draft creates, as the My draft list shows it, with the rows its actions act on. */
export interface DraftConflict {
  readonly code: ConstraintCode;
  readonly orderId: string;
  /** The two rows, the earlier first, by display number. */
  readonly rows: readonly [string, string];
  /** The draft row the conflict comes from, which Move back discards. */
  readonly draftRow: string;
  /** The later row of a precedence break, whose order Cascade from here walks. */
  readonly laterRow: string;
  readonly clearsAtMs?: number;
  /** "1003.20 starts 45 min before its release from 1003.10; clears at Wed 4 Nov 13:30". */
  readonly text: string;
}

/** The snapshot's rows that the draft moved, by job order id. */
export function draftRowIds(draft: GanttDraft): ReadonlySet<string> {
  return new Set(draft.changes.map((change) => change.jobOrderId));
}

/**
 * The snapshot with the draft applied: every changed row at its draft span on its draft machine,
 * its segments laid over the calendar, and the analysis computed again over the result, so the
 * floats, links, constraint lists and workload follow the draft (plan 18).
 */
export function applyDraft(
  committed: GanttSnapshot,
  draft: GanttDraft,
  range: { readonly fromMs: number; readonly toMs: number } = {
    fromMs: committed.nowMs,
    toMs: committed.fenceMs,
  },
): GanttSnapshot {
  if (draft.changes.length === 0 && draft.runs.length === 0) return committed;
  const context = planContextOf(committed, range);
  const byRow = new Map(draft.changes.map((change) => [change.jobOrderId, change]));
  const productionOrders: GanttOrder[] = committed.productionOrders.map((order) => ({
    ...order,
    jobOrders: order.jobOrders.map((row) => {
      const change = byRow.get(row.id);
      if (change === undefined) return row;
      const plannedSetupS = change.setupS ?? row.plannedSetupS;
      return {
        ...row,
        equipment: change.equipment,
        plannedSetupS,
        placement: placementWithSegments(
          { plannedSetupS, plannedRunS: row.plannedRunS },
          change.to,
          context.availability[change.equipment] ?? [],
        ),
      };
    }),
  }));
  const base: GanttSnapshotBase = { ...committed, productionOrders, runs: draft.runs };
  return { ...base, analysis: analyzeGantt(base, range) };
}

/** The draft with the moves of a cascade or a run added; a row already in the draft keeps its committed origin. */
function withMoves(
  draft: GanttDraft,
  orderOf: (jobOrderId: string) => string,
  moves: readonly PlacedMove[],
  runId?: string,
): GanttDraft {
  const changes = [...draft.changes];
  for (const move of moves) {
    const index = changes.findIndex((change) => change.jobOrderId === move.jobOrderId);
    const existing = changes[index];
    const setupS = move.setupS ?? existing?.setupS;
    const change: DraftChange = {
      jobOrderId: move.jobOrderId,
      displayNumber: move.displayNumber,
      orderId: orderOf(move.jobOrderId),
      equipment: move.equipment,
      ...((existing?.from ?? move.from) !== undefined && { from: existing?.from ?? move.from }),
      to: move.to,
      reason:
        existing !== undefined && existing.reason !== 'cascade' && move.reason === 'cascade'
          ? existing.reason
          : move.reason,
      ...((runId ?? existing?.runId) !== undefined && { runId: runId ?? existing?.runId }),
      ...(setupS !== undefined && { setupS }),
    };
    if (index >= 0) changes[index] = change;
    else changes.push(change);
  }
  return { changes, runs: draft.runs };
}

/**
 * A move written into the draft (plan 18, Cascade rule 7): the cascade runs over the committed
 * plan with the draft applied, and every move it returns becomes a draft change. A refused move
 * leaves the draft as it was; the result says why.
 */
export function moveInDraft(
  committed: GanttSnapshot,
  draft: GanttDraft,
  move: Move,
  options: CascadeOptions = {},
): { readonly draft: GanttDraft; readonly result: CascadeResult } {
  const applied = applyDraft(committed, draft);
  const order = applied.productionOrders.find((each) =>
    each.jobOrders.some((row) => row.id === move.jobOrderId),
  );
  if (order === undefined) {
    throw new Error(`No job order ${move.jobOrderId} in the plan`);
  }
  const context = planContextOf(applied, { fromMs: applied.nowMs, toMs: applied.fenceMs });
  const result = cascade(order, move, context, options);
  if (result.refused !== undefined || result.moves.length === 0) return { draft, result };
  return { draft: withMoves(draft, () => order.id, result.moves), result };
}

/** The display numbers of a conflict line, as its text names the rows. */
export function conflictText(
  timeZone: string,
  code: ConstraintCode,
  rows: readonly [string, string],
  clearsAtMs: number | undefined,
  beforeByS: number | undefined,
): string {
  const at = (ms: number) => formatPlantDateTime(ms, timeZone);
  const clears = clearsAtMs === undefined ? '' : `; clears at ${at(clearsAtMs)}`;
  switch (code) {
    case 'LEAD_TIME':
    case 'SEND_AHEAD':
      return beforeByS === undefined
        ? `${rows[1]} starts before its release from ${rows[0]}${clears}`
        : `${rows[1]} starts ${formatDuration(beforeByS)} before its release from ${rows[0]}${clears}`;
    case 'LAST_PIECE':
      return `${rows[1]} ends before the last piece of ${rows[0]}${clears}`;
    case 'OVERLAP':
      return `${rows[0]} and ${rows[1]} overlap on the same machine`;
    case 'CLOSED_TIME':
      return `${rows[1]} has work in closed time`;
    default:
      return `${rows[1]}: ${code}`;
  }
}

/**
 * The conflicts the draft creates (plan 18, Resolving a break in the draft): every broken
 * precedence or overlap line of a draft row, or of a row whose predecessor or machine neighbour is
 * a draft row, one line per conflict with the two rows, the rule and the instant that clears it.
 * The list equals what validate() finds for the draft over the committed rows.
 */
export function draftConflicts(applied: GanttSnapshot, draft: GanttDraft): DraftConflict[] {
  const draftIds = draftRowIds(draft);
  const conflicts: DraftConflict[] = [];
  const seen = new Set<string>();
  for (const order of applied.productionOrders) {
    for (const row of order.jobOrders) {
      const lines = applied.analysis.jobOrders[row.id]?.constraints ?? [];
      for (const line of lines) {
        if (line.holds || line.code === undefined) continue;
        if (
          !['LEAD_TIME', 'SEND_AHEAD', 'LAST_PIECE', 'OVERLAP', 'CLOSED_TIME'].includes(line.code)
        )
          continue;
        const other = line.involves?.[0];
        const otherRow =
          other === undefined
            ? undefined
            : applied.productionOrders
                .flatMap((each) => each.jobOrders)
                .find((each) => each.displayNumber === other);
        const involved = [row.id, otherRow?.id].filter((id): id is string => id !== undefined);
        const draftRow = involved.find((id) => draftIds.has(id));
        if (draftRow === undefined) continue;
        const pair: [string, string] =
          line.code === 'OVERLAP'
            ? ([row.displayNumber, other ?? ''].sort() as [string, string])
            : [other ?? '', row.displayNumber];
        const key = `${line.code}:${pair.join(':')}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const release = applied.analysis.jobOrders[row.id]?.release;
        const placement = row.placement;
        const boundStart =
          placement === undefined
            ? undefined
            : applied.settings.retoolOverlapsLeadTime
              ? placement.runStartMs
              : placement.setupStartMs;
        const clearsAtMs = line.clearsAtMs;
        const beforeByS =
          release !== undefined && boundStart !== undefined
            ? (release.atMs - boundStart) / 1000
            : undefined;
        conflicts.push({
          code: line.code,
          orderId: order.id,
          rows: pair,
          draftRow,
          laterRow: row.id,
          ...(clearsAtMs !== undefined && { clearsAtMs }),
          text: conflictText(applied.plant.timeZone, line.code, pair, clearsAtMs, beforeByS),
        });
      }
    }
  }
  return conflicts;
}

/**
 * Cascade from here (plan 18, Resolving a break in the draft): the cascade of the conflict's order
 * from the earlier row at its draft position, so the later rows move under their release and the
 * line disappears. Only rows that move, or that the draft already holds, become changes; a refused
 * cascade (the earlier row is locked, started or held) leaves the draft as it was and says why.
 */
export function cascadeFromHere(
  committed: GanttSnapshot,
  draft: GanttDraft,
  conflict: DraftConflict,
): { readonly draft: GanttDraft; readonly refused?: MoveRefusal } {
  const applied = applyDraft(committed, draft);
  const order = applied.productionOrders.find((each) => each.id === conflict.orderId);
  const earlier = order?.jobOrders.find((row) => row.displayNumber === conflict.rows[0]);
  if (order === undefined || earlier?.placement === undefined) return { draft };
  const context = planContextOf(applied, { fromMs: applied.nowMs, toMs: applied.fenceMs });
  const result = cascade(
    order,
    {
      jobOrderId: earlier.id,
      setupStartMs: earlier.placement.setupStartMs,
      equipment: earlier.equipment,
    },
    context,
    { cascade: true },
  );
  if (result.refused !== undefined) return { draft, refused: result.refused };
  const inDraft = draftRowIds(draft);
  const moved = result.moves.filter((move) => {
    if (inDraft.has(move.jobOrderId)) return true;
    const row = order.jobOrders.find((each) => each.id === move.jobOrderId);
    const span = row?.placement;
    return (
      span === undefined ||
      row?.equipment !== move.equipment ||
      span.setupStartMs !== move.to.setupStartMs ||
      span.endMs !== move.to.endMs
    );
  });
  return { draft: withMoves(draft, () => order.id, moved) };
}

/**
 * Move back (plan 18, Resolving a break in the draft): the draft without the change that caused
 * the conflict; for a row a run placed, the run and its moves go (ADR 0083 rule 7).
 */
export function moveBack(draft: GanttDraft, conflict: DraftConflict): GanttDraft {
  const runId = draft.changes.find((change) => change.jobOrderId === conflict.draftRow)?.runId;
  return runId === undefined
    ? discardChange(draft, conflict.draftRow)
    : splitRunInDraft(draft, runId);
}

/** The draft without one row's change. */
export function discardChange(draft: GanttDraft, jobOrderId: string): GanttDraft {
  return {
    changes: draft.changes.filter((change) => change.jobOrderId !== jobOrderId),
    runs: draft.runs,
  };
}

/** The changes the My draft list counts: a run is one change, its moves are inside it (plan 18, Runs). */
export function draftChangeCount(draft: GanttDraft): number {
  return draft.changes.filter((change) => change.runId === undefined).length + draft.runs.length;
}

/**
 * The run of the selected orders as the review step shows it (plan 18, The review step): the
 * domain's combineIntoRun over the plan with the draft applied, without writing anything.
 */
export function runPreview(
  committed: GanttSnapshot,
  draft: GanttDraft,
  orderIds: readonly string[],
): RunResult {
  const applied = applyDraft(committed, draft);
  const context = planContextOf(applied, { fromMs: applied.nowMs, toMs: applied.fenceMs });
  const orders = applied.productionOrders.filter((order) => orderIds.includes(order.id));
  return combineIntoRun(orders, context);
}

/**
 * Combine into a run (ADR 0083 rule 8): the run becomes a record of the draft and every move it
 * made a change of the run, so the My draft list shows one line. A refusal leaves the draft as it
 * was; the result says why.
 */
export function combineInDraft(
  committed: GanttSnapshot,
  draft: GanttDraft,
  orderIds: readonly string[],
): { readonly draft: GanttDraft; readonly result: RunResult } {
  const result = runPreview(committed, draft, orderIds);
  const run = result.run;
  if (result.refused !== undefined || run === undefined) return { draft, result };
  const orderOf = (jobOrderId: string) =>
    committed.productionOrders.find((order) => order.jobOrders.some((row) => row.id === jobOrderId))
      ?.id ?? '';
  const withRun = withMoves(draft, orderOf, result.moves, run.id);
  return { draft: { changes: withRun.changes, runs: [...draft.runs, run] }, result };
}

/** Split run (ADR 0083 rule 7): a run of the draft goes with its moves, so the orders are separate again. */
export function splitRunInDraft(draft: GanttDraft, runId: string): GanttDraft {
  return {
    changes: draft.changes.filter((change) => change.runId !== runId),
    runs: draft.runs.filter((run) => run.id !== runId),
  };
}

/** "1001 and 1005", "1001, 1004 and 1005". */
export function orderNumbersText(numbers: readonly string[]): string {
  if (numbers.length <= 1) return numbers.join('');
  return `${numbers.slice(0, -1).join(', ')} and ${numbers[numbers.length - 1]}`;
}

/** "1001 and 1005, 2 rows moved, 1 retool saved": what the run did, for its line and its announcement. */
export function runSummary(draft: GanttDraft, run: Run): string {
  const moved = draft.changes.filter((change) => change.runId === run.id).length;
  const saved = run.savedSetups.length;
  return `${orderNumbersText(run.orderNumbers)}, ${moved === 1 ? '1 row moved' : `${moved} rows moved`}, ${saved === 1 ? '1 retool saved' : `${saved} retools saved`}`;
}

/** The words of a conflict the domain reports, as the review step and the My draft list show them. */
export function conflictWords(timeZone: string, conflict: Conflict): string {
  const [first = '', second = ''] = conflict.rows;
  if (conflict.kind === 'FROZEN_WINDOW') return `${first} starts inside the frozen window`;
  return conflictText(timeZone, conflict.kind, [first, second], conflict.clearsAtMs, undefined);
}
