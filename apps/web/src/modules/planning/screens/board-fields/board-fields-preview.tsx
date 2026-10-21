// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatSpan } from '@northmes/contracts/format';
import { FormSection } from '../../../../ui/components/form-section/index.ts';
import {
  type BoardFieldLists,
  type BoardFieldRow,
  blockLines,
  shownFields,
} from '../../board-fields.ts';
import type { GanttSnapshot } from '../../gantt-data.ts';

/** The job order the preview draws: the first placed one of the plan, 1001.10 on G1. */
function previewRow(snapshot: GanttSnapshot): BoardFieldRow | undefined {
  for (const order of snapshot.productionOrders) {
    for (const jobOrder of order.jobOrders) {
      const operation = order.operations.find((each) => each.id === jobOrder.operationId);
      if (operation !== undefined && jobOrder.placement !== undefined) {
        return { order, operation, jobOrder, analysis: snapshot.analysis.jobOrders[jobOrder.id] };
      }
    }
  }
  return undefined;
}

/** One block as the board and the Gantt draw it at a width: full, compact or a bar. */
function PreviewBlock({
  number,
  color,
  first,
  second,
  trailing,
  width,
}: {
  readonly number: string;
  readonly color: string;
  readonly first?: string;
  readonly second?: string;
  readonly trailing?: readonly string[];
  readonly width: number;
}) {
  return (
    <span
      className="absolute top-0.5 grid h-11 content-start overflow-hidden border border-block-border px-1.5 py-0.5 text-xs leading-4 text-black"
      style={{ width: `${width}px`, background: `var(--${color})` }}
    >
      {first !== undefined && (
        <span className="truncate font-mono font-bold">
          {first === '' ? number : `${number} ${first}`}
        </span>
      )}
      {(second !== undefined || (trailing?.length ?? 0) > 0) && (
        <span className="flex items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate">{second}</span>
          {trailing?.map((text) => (
            <span key={text} className="shrink-0 font-semibold">
              {text}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}

/**
 * The preview of the page (#762, BF2): the first placed job order of the plan as a full block, a
 * compact block and a bar, the words its name gains, and its hover card with the chosen hover
 * fields, which Details lists as well. The Gantt's card adds its analysis lines after them.
 */
export function BoardFieldsPreview({
  snapshot,
  lists,
  saved,
}: {
  readonly snapshot: GanttSnapshot;
  readonly lists: BoardFieldLists;
  /** Whether the lists are the saved ones, or changes the preview shows ahead of Save. */
  readonly saved: boolean;
}) {
  const row = previewRow(snapshot);
  if (row === undefined) return null;
  const machineName = (code: string | undefined) =>
    snapshot.equipment.find((machine) => machine.code === code)?.name ?? code ?? '';
  const lines = blockLines(lists.block, row, snapshot, machineName);
  const hover = shownFields(lists.hover, row, snapshot, machineName);
  const { operation, order, jobOrder } = row;
  const timeZone = snapshot.plant.timeZone;
  const span =
    jobOrder.placement === undefined
      ? ''
      : formatSpan(jobOrder.placement.setupStartMs, jobOrder.placement.endMs, timeZone);
  const name = [
    `${operation.displayNumber} ${operation.name}`,
    order.article,
    `${jobOrder.quantity} pcs`,
    machineName(jobOrder.equipment),
    span,
    ...lines.extraNames,
  ].join(', ');
  return (
    <FormSection
      title="Preview"
      description={`Job order ${operation.displayNumber} on ${machineName(jobOrder.equipment)}, as the board and the Gantt draw it ${saved ? 'now' : 'after Save'}.`}
    >
      <div className="grid gap-x-6 gap-y-4 md:grid-cols-[minmax(0,1fr)_18.75rem]">
        <div aria-hidden className="grid min-w-0 content-start gap-2">
          <p className="text-xs font-semibold text-muted-foreground">
            Full block, 120 px and wider
          </p>
          <span className="relative block h-12 overflow-hidden rounded border border-border bg-lane">
            <PreviewBlock
              number={operation.displayNumber}
              color={order.color}
              first={lines.first ?? ''}
              second={lines.second}
              trailing={lines.trailing.map((field) => field.text)}
              width={340}
            />
          </span>
          <p className="text-xs font-semibold text-muted-foreground">
            Compact block, 66 to 119 px, and a bar under 66 px
          </p>
          <span className="relative block h-12 overflow-hidden rounded border border-border bg-lane">
            <PreviewBlock
              number={operation.displayNumber}
              color={order.color}
              first=""
              second={lines.first}
              width={104}
            />
            <span
              className="absolute top-0.5 left-[7.5rem] h-11 w-10 border border-block-border"
              style={{ background: `var(--${order.color})` }}
            />
          </span>
        </div>
        <div className="grid content-start gap-2">
          <p className="text-xs font-semibold text-muted-foreground" aria-hidden>
            Hover card
          </p>
          <div className="grid gap-1 rounded-md border border-border bg-popover px-3 py-2.5 text-popover-foreground shadow-sm">
            <p className="font-mono text-sm font-semibold">
              {operation.displayNumber} {operation.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {order.article}, {jobOrder.quantity} pcs, order {order.number}
            </p>
            {hover.length > 0 && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[0.8125rem]">
                {hover.map((field) => (
                  <div key={field.id} className="contents">
                    <dt className="text-muted-foreground">{field.label}</dt>
                    <dd className="text-end font-mono text-xs">{field.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">The block's name for screen readers: {name}.</p>
      <p className="text-xs text-muted-foreground">
        {hover.length > 0
          ? `Details lists the same ${hover.length} fields in this order.`
          : 'Details shows its fixed sections only.'}
      </p>
      <p className="text-xs text-muted-foreground">
        On the Gantt the hover card then adds its analysis: working and elapsed time, setup and run,
        free float, release and constraints.
      </p>
    </FormSection>
  );
}
