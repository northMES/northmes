// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { useNavigate, useSearch } from '@tanstack/react-router';
import { type BoardView, boardSearch, withView } from '../../gantt-search.ts';
import { PressedGroup } from './pressed-group.tsx';

const views: readonly { readonly id: BoardView; readonly label: string }[] = [
  { id: 'board', label: 'Board' },
  { id: 'gantt', label: 'Gantt' },
  { id: 'table', label: 'Table' },
];

/**
 * The View control of the board route (plan 18, URL state): Board, Gantt and Table on every view,
 * so a planner comes back from the board stub to the Gantt. A switch keeps zoom, from and the
 * selected order, which mean the same in each view.
 */
export function ViewSwitch() {
  const search = boardSearch(useSearch({ strict: false }));
  const navigate = useNavigate();
  return (
    <PressedGroup
      label="View"
      choices={views}
      value={search.view ?? 'board'}
      onChange={(view) =>
        void navigate({
          to: '.',
          search: withView(search, view) as Record<string, unknown>,
          replace: true,
        })
      }
    />
  );
}
