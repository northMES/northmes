// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { machineCountText } from '../../equipment-group-facts.ts';
import { GroupColor } from '../group-color/index.ts';

/**
 * A group's band as the board draws it (design #729, EG4 and EG5): the color stripe with the
 * group's name and machine count, then a row per machine with the color dot. Like the board, it
 * draws only the plannable machines, and a group with none says that the board draws no band for
 * it. The name is always written beside the color.
 */
export function GroupBand({
  name,
  color,
  machines,
}: {
  readonly name: string;
  readonly color: string;
  /** The group's machines at the plant, by code. */
  readonly machines: readonly {
    readonly code: string;
    readonly name: string;
    readonly isPlannable: boolean;
  }[];
}) {
  const rows = machines.filter((machine) => machine.isPlannable);
  return (
    <figure
      aria-label={`${name} on the board`}
      className="flex max-w-md flex-col overflow-hidden rounded-md border border-border bg-background"
    >
      <div className="flex items-center gap-2 bg-muted px-3 py-2 text-sm">
        <GroupColor color={color} shape="stripe" />
        <span className="font-semibold">{name}</span>
        <span className="text-xs text-muted-foreground">
          {rows.length === 0 ? 'No plannable machines' : machineCountText(rows.length)}
        </span>
      </div>
      {rows.length === 0 && (
        <p className="border-t border-border px-3 py-1.5 text-sm text-muted-foreground">
          The board draws no band for this group until a plannable machine joins it.
        </p>
      )}
      {rows.map((machine) => (
        <div
          key={machine.code}
          className="flex items-center gap-2 border-t border-border px-3 py-1.5 text-sm"
        >
          <GroupColor color={color} shape="dot" />
          {machine.name}
        </div>
      ))}
    </figure>
  );
}
