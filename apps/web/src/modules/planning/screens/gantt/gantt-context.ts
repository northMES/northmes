// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { createContext, useContext } from 'react';
import type { BoardFieldLists } from '../../board-fields.ts';
import type { GanttSnapshot } from '../../gantt-data.ts';
import type { ClosedWindow, TimeScale } from '../../timeline/time-scale.ts';
import type { MovePreview, MoveState } from './gantt-move.ts';

/** The move in progress and the actions of a block on it (plan 18, Moves on the order Gantt). */
export interface GanttMoveActions {
  readonly state: MoveState | undefined;
  readonly preview: MovePreview | undefined;
  /** Starts a move of a row; false, with the refusal announced, when the row cannot move. */
  readonly begin: (jobOrderId: string, source: MoveState['source']) => boolean;
  /** Holds the moving row at a setup start, on another allowed machine when one is named. */
  readonly previewAt: (setupStartMs: number, equipment?: string) => void;
  readonly stepTime: (direction: -1 | 1) => void;
  readonly stepMachine: (direction: -1 | 1) => void;
  readonly commit: () => void;
  readonly cancel: () => void;
}

/** Whether an order can be combined into a run with the selection, and why not (plan 18, Runs). */
export type CombineCheck = { readonly ok: true } | { readonly ok: false; readonly reason: string };

/** The run actions of the order and run rows (ADR 0083, plan 18 Runs). */
export interface GanttRunActions {
  /** Whether Combine into a run is enabled for an order, given the selection it joins. */
  readonly canCombine: (orderId: string) => CombineCheck;
  /** Opens the review step for the selection with the order. */
  readonly combine: (orderId: string) => void;
  /** Splits a run of the draft: the run and its moves go. */
  readonly split: (runId: string) => void;
}

/** What every row of the order Gantt reads: the snapshot, the one scale and the view's state. */
export interface GanttViewContext {
  readonly snapshot: GanttSnapshot;
  readonly scale: TimeScale;
  /** The closed windows of the plant calendar inside the range, which summary rows shade. */
  readonly closedWindows: readonly ClosedWindow[];
  /** The closed windows of a machine's calendar, which its job order rows shade. */
  readonly closedWindowsOf: (equipment: string | undefined) => readonly ClosedWindow[];
  readonly timeZone: string;
  /** Whether the browser zone differs from the plant zone, so plant times carry a zone label. */
  readonly zoneLabel: boolean;
  readonly hideClosed: boolean;
  /** The selected order, by id: the first of the selection, which the URL names. */
  readonly selectedOrderId: string | undefined;
  /** Every selected order, the first and the ones Shift+click or Shift+Space added (plan 18, Runs). */
  readonly selectedOrderIds: ReadonlySet<string>;
  /** The rows of the highlighted critical chain, none while no chain is shown. */
  readonly chainRowIds: ReadonlySet<string>;
  /** The name of a machine by code, its code when unknown. */
  readonly machineName: (code: string | undefined) => string;
  /** The rows the planner's draft moved, drawn in the draft style. */
  readonly draftRowIds?: ReadonlySet<string>;
  readonly move?: GanttMoveActions;
  readonly runActions?: GanttRunActions;
  /** Show critical chain from a row's menu. */
  readonly toggleChain?: (orderId: string) => void;
  /** The plant's block and hover fields (#762); the company's lists when none are given. */
  readonly boardFields?: BoardFieldLists;
}

const GanttContext = createContext<GanttViewContext | undefined>(undefined);

export const GanttViewProvider = GanttContext.Provider;

export function useGanttView(): GanttViewContext {
  const context = useContext(GanttContext);
  if (context === undefined) throw new Error('useGanttView() found no GanttViewProvider');
  return context;
}
