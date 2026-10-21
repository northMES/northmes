// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The arrow keys of the board grid (plan 07, Grid semantics and focus; design D3, Keyboard model):
// which focus target a key moves to from another, over the lines the grid draws. The grid keeps
// one Tab stop, the roving tabindex, on the target this returns.

/** A focus target of the grid: a job order, an empty cell, a row header or a group button. */
export interface BoardCell {
  readonly key: string;
  /** The span of a job order, which Up and Down match in time; none for an empty cell. */
  readonly fromMs?: number;
  readonly toMs?: number;
}

/** A line of the grid: the Not placed row, a group band or a machine row. */
export interface BoardLine {
  readonly kind: 'notPlaced' | 'group' | 'machine';
  /** The line's target in the row header column: a machine's row header, a group's button. */
  readonly header?: string;
  /** The line's cells in time order; a group band has none. */
  readonly cells: readonly BoardCell[];
}

/** Where a key is pressed: the cell and the line that hold it. */
function locate(
  lines: readonly BoardLine[],
  key: string,
): { readonly line: number; readonly cell: number } | undefined {
  for (const [line, each] of lines.entries()) {
    if (each.header === key) return { line, cell: -1 };
    const cell = each.cells.findIndex((target) => target.key === key);
    if (cell >= 0) return { line, cell };
  }
  return undefined;
}

/**
 * The cell of a line that runs at an instant, else the one whose start lies nearest to it; the
 * first cell when there is no instant to match (plan 07: the block nearest in time).
 */
function nearestIn(line: BoardLine, atMs: number | undefined): string | undefined {
  const cells = line.cells;
  if (atMs === undefined) return cells[0]?.key;
  const running = cells.find(
    (cell) =>
      cell.fromMs !== undefined &&
      cell.toMs !== undefined &&
      cell.fromMs <= atMs &&
      atMs < cell.toMs,
  );
  if (running !== undefined) return running.key;
  let best: BoardCell | undefined;
  for (const cell of cells) {
    if (cell.fromMs === undefined) continue;
    if (best?.fromMs === undefined || Math.abs(cell.fromMs - atMs) < Math.abs(best.fromMs - atMs)) {
      best = cell;
    }
  }
  return (best ?? cells[0])?.key;
}

/** The index of the machine line `steps` machine lines away, else of the last one there is. */
function machineLineFrom(
  lines: readonly BoardLine[],
  from: number,
  steps: number,
): number | undefined {
  const direction = Math.sign(steps);
  let found: number | undefined;
  let left = Math.abs(steps);
  for (let index = from + direction; index >= 0 && index < lines.length; index += direction) {
    if (lines[index]?.kind !== 'machine') continue;
    found = index;
    left -= 1;
    if (left === 0) break;
  }
  return found;
}

/**
 * The target a key moves focus to, or none when the key does not move it (design D3, Keyboard
 * model). In a row, Left and Right go along it in time order, Home and End to its ends, and Left
 * from the first cell to the row header; Up and Down go to the adjacent machine row, past group
 * bands, to the cell that runs at the focused one's start, else to the nearest start, and Up from
 * the first machine row reaches the Not placed row; Page Up and Page Down go `page` machine rows.
 * In the row header column, Up and Down go through the row headers and the group buttons, and
 * Right returns to the row's first cell.
 */
export function boardFocusAfter(
  lines: readonly BoardLine[],
  current: string,
  key: string,
  page = 5,
): string | undefined {
  const at = locate(lines, current);
  if (at === undefined) return undefined;
  const line = lines[at.line];
  if (line === undefined) return undefined;
  if (at.cell < 0) {
    const headers = lines.flatMap((each) => (each.header === undefined ? [] : [each.header]));
    const index = headers.indexOf(current);
    switch (key) {
      case 'ArrowDown':
        return headers[index + 1];
      case 'ArrowUp':
        return headers[index - 1];
      case 'Home':
        return headers[0];
      case 'End':
        return headers[headers.length - 1];
      case 'ArrowRight':
        return line.cells[0]?.key;
      default:
        return undefined;
    }
  }
  const cell = line.cells[at.cell];
  switch (key) {
    case 'ArrowRight':
      return line.cells[at.cell + 1]?.key;
    case 'ArrowLeft':
      return at.cell === 0 ? line.header : line.cells[at.cell - 1]?.key;
    case 'Home':
      return line.cells[0]?.key;
    case 'End':
      return line.cells[line.cells.length - 1]?.key;
    case 'ArrowDown':
    case 'ArrowUp':
    case 'PageDown':
    case 'PageUp': {
      const steps =
        key === 'ArrowDown' ? 1 : key === 'ArrowUp' ? -1 : key === 'PageDown' ? page : -page;
      const target = machineLineFrom(lines, at.line, steps);
      if (target !== undefined) return nearestIn(lines[target] as BoardLine, cell?.fromMs);
      if (steps < 0 && line.kind === 'machine') {
        const notPlaced = lines.find((each) => each.kind === 'notPlaced');
        return notPlaced === undefined ? undefined : nearestIn(notPlaced, undefined);
      }
      return undefined;
    }
    default:
      return undefined;
  }
}

/**
 * Where Tab enters the grid when no job order is selected (design D3, Keyboard model, proposed):
 * the cell of the first machine row that runs at now, else the one nearest to now, else the first
 * cell there is.
 */
export function boardEntry(lines: readonly BoardLine[], nowMs: number): string | undefined {
  const first = lines.find((line) => line.kind === 'machine');
  if (first !== undefined) return nearestIn(first, nowMs);
  return lines.find((line) => line.cells.length > 0)?.cells[0]?.key;
}
