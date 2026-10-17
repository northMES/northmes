// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { useSearch } from '@tanstack/react-router';
import { boardSearch } from '../../gantt-search.ts';
import { GanttScreen } from '../gantt/index.ts';
import { BoardScreen } from './board-screen.tsx';

/**
 * The board route's view (plan 18, URL state): the order Gantt at view=gantt, else the board,
 * which the E02 stub stands in for until E08 builds it. One lazy component on the route, so the
 * switch happens inside the planning chunk and the router loads it once.
 */
export function BoardRoute() {
  const { view } = boardSearch(useSearch({ strict: false }));
  return view === 'gantt' ? <GanttScreen /> : <BoardScreen />;
}
