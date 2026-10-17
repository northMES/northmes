// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { createContext, useContext } from 'react';
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
  /** The selected order, by id. */
  readonly selectedOrderId: string | undefined;
  /** The rows of the highlighted critical chain, none while no chain is shown. */
  readonly chainRowIds: ReadonlySet<string>;
  /** The name of a machine by code, its code when unknown. */
  readonly machineName: (code: string | undefined) => string;
  /** The rows the planner's draft moved, drawn in the draft style. */
  readonly draftRowIds?: ReadonlySet<string>;
  readonly move?: GanttMoveActions;
}

const GanttContext = createContext<GanttViewContext | undefined>(undefined);

export const GanttViewProvider = GanttContext.Provider;

export function useGanttView(): GanttViewContext {
  const context = useContext(GanttContext);
  if (context === undefined) throw new Error('useGanttView() found no GanttViewProvider');
  return context;
}
