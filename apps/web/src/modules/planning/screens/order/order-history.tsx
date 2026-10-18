// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cn } from 'cn';
import { ChevronRight } from 'lucide-react';
import { Fragment, useState } from 'react';
import { StatusBadge } from '../../../../ui/components/status-badge/index.ts';
import { Button } from '../../../../ui/primitives/button.tsx';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/primitives/table.tsx';
import type { GanttOrder, GanttSnapshot, HistoryEntry } from '../../gantt-data.ts';
import { plantTime } from '../../order-facts.ts';

const head = 'h-auto px-3 py-2 text-xs font-semibold text-muted-foreground';
const cell = 'px-3 py-2 whitespace-normal';

/** The changes of one entry, under its row (PO3). */
function Changes({ entry, when }: { readonly entry: HistoryEntry; readonly when: string }) {
  return (
    <Table className="w-auto min-w-140 rounded-md border border-border bg-card">
      <TableCaption className="sr-only">Changes on {when}</TableCaption>
      <TableHeader className="bg-muted">
        <TableRow className="hover:bg-transparent">
          {['Field', 'Before', 'After'].map((label) => (
            <TableHead key={label} scope="col" className={head}>
              {label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {entry.changes.map((change) => (
          <TableRow key={change.field}>
            <TableCell className={cell}>{change.field}</TableCell>
            <TableCell className={cn(cell, 'font-mono')}>{change.before}</TableCell>
            <TableCell className={cn(cell, 'font-mono')}>{change.after}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * The History tab of an order's page (design ui-222, DE3; #686, PO3): the entries newest first,
 * each with when, who, the surface, the reason and a summary, and a disclosure that opens the
 * changed fields with their values before and after. The newest entry with changes opens by
 * itself. The fixture holds the history of one order; the server's audit trail replaces it.
 */
export function OrderHistory({
  snapshot,
  order,
}: {
  readonly snapshot: GanttSnapshot;
  readonly order: GanttOrder;
}) {
  const entries = snapshot.history?.[order.id] ?? [];
  const [open, setOpen] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        entries
          .filter((entry) => entry.changes.length > 0)
          .slice(0, 1)
          .map((e) => e.id),
      ),
  );
  if (entries.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        No history entries in the fixture for this order.
      </p>
    );
  }
  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Table>
        <TableCaption className="sr-only">History of order {order.number}</TableCaption>
        <TableHeader className="bg-muted">
          <TableRow className="hover:bg-transparent">
            <TableHead scope="col" className={cn(head, 'w-10')}>
              <span className="sr-only">Details</span>
            </TableHead>
            {['When', 'Changed by', 'Surface', 'Reason', 'Changes'].map((label) => (
              <TableHead key={label} scope="col" className={head}>
                {label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => {
            const when = plantTime(snapshot, entry.atMs);
            const expanded = open.has(entry.id);
            return (
              <Fragment key={entry.id}>
                <TableRow>
                  <TableCell className={cn(cell, 'py-1')}>
                    {entry.changes.length > 0 && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-expanded={expanded}
                        aria-label={`${expanded ? 'Hide' : 'Show'} the changes of ${when}`}
                        onClick={() => toggle(entry.id)}
                      >
                        <ChevronRight
                          aria-hidden
                          className={cn(
                            'size-4 transition-transform motion-reduce:transition-none',
                            expanded && 'rotate-90',
                          )}
                        />
                      </Button>
                    )}
                  </TableCell>
                  <TableCell className={cn(cell, 'font-mono')}>{when}</TableCell>
                  <TableCell className={cell}>{entry.by}</TableCell>
                  <TableCell className={cell}>
                    <StatusBadge tone="neutral">{entry.surface}</StatusBadge>
                  </TableCell>
                  <TableCell className={cell}>
                    {entry.reason ?? <span className="text-muted-foreground">No reason given</span>}
                  </TableCell>
                  <TableCell className={cell}>{entry.summary}</TableCell>
                </TableRow>
                {expanded && (
                  <TableRow className="bg-muted hover:bg-muted">
                    <TableCell />
                    <TableCell colSpan={5} className={cn(cell, 'py-3')}>
                      <Changes entry={entry} when={when} />
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
      <p className="border-t border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
        Newest first. {entries.length} entries.
      </p>
    </div>
  );
}
