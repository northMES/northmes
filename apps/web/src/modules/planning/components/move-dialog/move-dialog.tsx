// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatDuration, formatPlantDateTime, formatPlantTime } from '@northmes/contracts/format';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { ErrorSummary } from '../../../../ui/components/error-summary/index.ts';
import { TextField } from '../../../../ui/components/text-field/index.ts';
import { Button } from '../../../../ui/primitives/button.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/primitives/dialog.tsx';
import { RadioGroup, RadioGroupItem } from '../../../../ui/primitives/radio-group.tsx';
import type { GanttSnapshot } from '../../gantt-data.ts';
import {
  type MovePreview,
  previewOf,
  refusalMessage,
  stepLaterStart,
} from '../../screens/gantt/gantt-move.ts';
import type { JobOrderRow } from '../../screens/gantt/gantt-rows.ts';
import { startOf, startText } from './move-dialog-start.ts';

export interface MoveDialogProps {
  readonly open: boolean;
  /** The job order the dialog moves, kept while it closes so it fades out with its content. */
  readonly row: JobOrderRow | undefined;
  /** The plan with the planner's draft applied, which the Ends and Overlaps columns read. */
  readonly snapshot: GanttSnapshot;
  readonly machineName: (code: string) => string;
  /** The zoom preset's snap step, which the step buttons move the start by. */
  readonly stepMs: number;
  /** The preset's name, "Week", for the hint under Start. */
  readonly presetLabel: string;
  /** Runs on Move with the chosen machine and start: the move goes into the draft. */
  readonly onMove: (equipment: string, setupStartMs: number) => void;
  readonly onCancel: () => void;
  /** The element that takes focus once the dialog has closed: its trigger, or the moved block. */
  readonly finalFocus: () => HTMLElement | null;
}

/**
 * The job orders on a machine that a move's span would overlap, past the rows the cascade moves,
 * each with when it ends and whether its order is late (design D3, IN8).
 */
function overlapsOf(
  snapshot: GanttSnapshot,
  preview: MovePreview | undefined,
  equipment: string,
): string {
  if (preview === undefined) return 'none';
  const { setupStartMs, endMs } = preview.span;
  const timeZone = snapshot.plant.timeZone;
  const names = snapshot.productionOrders.flatMap((order) =>
    order.jobOrders.flatMap((row) => {
      if (row.id === preview.jobOrderId || row.equipment !== equipment) return [];
      const span = preview.ghosts.get(row.id) ?? row.placement;
      if (span === undefined || span.endMs <= setupStartMs || span.setupStartMs >= endMs) return [];
      const analysis = snapshot.analysis.orders[order.id];
      const late = analysis?.late ? `, late by ${formatDuration(-analysis.slackElapsedS)}` : '';
      return [
        `${row.displayNumber} ${order.article}, until ${formatPlantTime(span.endMs, timeZone)}${late}`,
      ];
    }),
  );
  return names.length === 0 ? 'none' : names.join(', ');
}

/** The first whole minute at or after an instant: the Start field takes whole minutes. */
function firstMinuteFrom(ms: number): number {
  return Math.ceil(ms / 60_000) * 60_000;
}

/**
 * The body of the Move dialog for one job order: its state starts from the row each time the
 * dialog opens, so a dialog closed without Move leaves nothing behind.
 */
function MoveForm({
  row,
  snapshot,
  machineName,
  stepMs,
  presetLabel,
  onMove,
  onCancel,
}: Omit<MoveDialogProps, 'open' | 'row' | 'finalFocus'> & { readonly row: JobOrderRow }) {
  const timeZone = snapshot.plant.timeZone;
  const placement = row.jobOrder.placement;
  const current = row.jobOrder.equipment ?? row.operation.allowedEquipment[0] ?? '';
  const [equipment, setEquipment] = useState(current);
  const [text, setText] = useState(
    placement === undefined ? '' : startText(placement.setupStartMs, timeZone),
  );
  const [submits, setSubmits] = useState(0);
  // Ends and Overlaps keep the last valid start until Start is valid again (design D3, IN9).
  const [setupStartMs, setSetupStartMs] = useState(placement?.setupStartMs ?? snapshot.nowMs);
  const parsed = startOf(text, timeZone);
  const edit = (next: string) => {
    setText(next);
    const instant = startOf(next, timeZone);
    if (instant !== undefined) setSetupStartMs(instant);
  };
  const ids = useId();
  const startId = `${ids}-start`;
  const zone = formatPlantTime(setupStartMs, timeZone, { zoneLabel: true }).split(' ').at(-1);
  const startLabel = `Start, plant time (${zone})`;
  const allowed = row.operation.allowedEquipment;
  const previews = useMemo(
    () =>
      new Map(
        allowed.map((code) => [
          code,
          previewOf(
            snapshot,
            { jobOrderId: row.id, setupStartMs, equipment: code, source: 'keyboard' },
            true,
          ),
        ]),
      ),
    [allowed, snapshot, row.id, setupStartMs],
  );
  const chosen = previews.get(equipment);
  const frozen = chosen?.conflicts.some((conflict) => conflict.kind === 'FROZEN_WINDOW') === true;
  // A start before now is refused with PAST as a drag's would be (ADR 0089): Move keeps the
  // dialog open with the refusal on the field.
  const past = parsed !== undefined && chosen?.refused === 'PAST';
  const showError = submits > 0 && (parsed === undefined || past);
  const fieldError = past
    ? `${refusalMessage(row.jobOrder.displayNumber, 'PAST')} Enter a start at or after ${formatPlantDateTime(firstMinuteFrom(snapshot.nowMs), timeZone)}.`
    : 'Enter a date and time like 2026-11-03 11:30.';
  const stepText = formatDuration(stepMs / 1000);
  // A step moves the start one snap from the snapped start the preview shows and writes the
  // snapped start. Backwards, the forward snap of the calendar can land on the same instant again,
  // so the step keeps going back until it is earlier, as move mode's does. It steps on instants,
  // so the hour that a change of clocks repeats is stepped through.
  const snappedAt = (atMs: number) =>
    previewOf(
      snapshot,
      { jobOrderId: row.id, setupStartMs: atMs, equipment, source: 'keyboard' },
      true,
    )?.span.setupStartMs ?? atMs;
  const step = (direction: -1 | 1) => {
    const from = chosen?.span.setupStartMs ?? setupStartMs;
    // Later from a start before now goes to the first step at or after now, as move mode does.
    let atMs = direction > 0 ? stepLaterStart(from, stepMs, snapshot.nowMs) : from - stepMs;
    for (let count = 0; direction < 0 && count < 500 && snappedAt(atMs) >= from; count += 1) {
      atMs -= stepMs;
    }
    const snapped = snappedAt(atMs);
    setSetupStartMs(snapped);
    setText(startText(snapped, timeZone));
  };
  return (
    <>
      <DialogHeader>
        <DialogTitle>
          Move <span className="font-mono">{row.jobOrder.displayNumber}</span> {row.order.article}
        </DialogTitle>
        <DialogDescription>
          Choose a machine and a start. The move goes into your draft, and Save writes it to the
          plan.
        </DialogDescription>
      </DialogHeader>
      <form
        noValidate
        id={`${ids}-form`}
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmits((count) => count + 1);
          if (parsed !== undefined && !past) onMove(equipment, parsed);
        }}
      >
        <ErrorSummary
          heading="1 field needs attention"
          errors={showError ? [{ name: 'start', fieldId: startId, message: startLabel }] : []}
          focusKey={submits}
        />
        <div className="grid gap-1.5">
          <span id={`${ids}-machine`} className="text-xs font-semibold">
            Machine
          </span>
          <RadioGroup
            value={equipment}
            onValueChange={(value) => setEquipment(String(value))}
            aria-labelledby={`${ids}-machine`}
            aria-describedby={`${ids}-machines`}
            className="block"
          >
            <table className="w-full text-start text-[0.8125rem]">
              <thead className="bg-muted text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="w-8 px-2 py-1.5">
                    <span className="sr-only">Choose</span>
                  </th>
                  <th scope="col" className="px-2 py-1.5 text-start font-medium">
                    Machine
                  </th>
                  <th scope="col" className="px-2 py-1.5 text-start font-medium">
                    Ends
                  </th>
                  <th scope="col" className="px-2 py-1.5 text-start font-medium">
                    Overlaps at this start
                  </th>
                </tr>
              </thead>
              <tbody>
                {allowed.map((code) => {
                  const preview = previews.get(code);
                  const rowId = `${ids}-${code}`;
                  return (
                    <tr key={code} className="border-b border-border">
                      <td className="px-2 py-1.5">
                        <RadioGroupItem
                          value={code}
                          aria-labelledby={`${rowId}-name`}
                          aria-describedby={`${rowId}-ends ${rowId}-overlaps`}
                        />
                      </td>
                      <th scope="row" id={`${rowId}-name`} className="px-2 py-1.5 text-start">
                        {machineName(code)}
                        {code === current && (
                          <>
                            <span className="sr-only">, </span>
                            <span className="ms-2 rounded-full bg-muted px-1.5 text-xs font-normal">
                              Current
                            </span>
                          </>
                        )}
                      </th>
                      <td id={`${rowId}-ends`} className="px-2 py-1.5 font-mono text-xs">
                        <span className="sr-only">Ends </span>
                        {preview === undefined
                          ? 'unknown'
                          : formatPlantDateTime(preview.span.endMs, timeZone)}
                      </td>
                      <td id={`${rowId}-overlaps`} className="px-2 py-1.5">
                        <span className="sr-only">Overlaps </span>
                        {overlapsOf(snapshot, preview, code)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </RadioGroup>
          <span id={`${ids}-machines`} className="text-xs text-muted-foreground">
            {allowed.length === 1 ? '1 allowed machine' : `${allowed.length} allowed machines`} for
            operation {row.operation.sequence}, {row.operation.name}.
          </span>
        </div>
        <div className="grid gap-1.5">
          <TextField
            id={startId}
            label={startLabel}
            value={text}
            onChange={(event) => edit(event.target.value)}
            className="font-mono"
            {...(showError && { error: fieldError })}
            hint={`${
              frozen
                ? `Starts in the frozen window, which ends at ${formatPlantTime(snapshot.fenceMs, timeZone)}, so Save asks for a reason. `
                : ''
            }Steps of ${stepText}, the ${presetLabel} snap.`}
          />
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              aria-label={`Start ${stepText} earlier`}
              onClick={() => step(-1)}
            >
              <ChevronLeft aria-hidden />
              {stepText} earlier
            </Button>
            <Button
              type="button"
              variant="outline"
              aria-label={`Start ${stepText} later`}
              onClick={() => step(1)}
            >
              {stepText} later
              <ChevronRight aria-hidden />
            </Button>
          </div>
        </div>
      </form>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" form={`${ids}-form`}>
          Move
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * The Move dialog (plan 07, Moving without dragging; design D3, IN8 and IN9), which the board's
 * block menu opens: every allowed machine as a radio with where the job order would end and what it
 * would overlap at the chosen start, the start in plant time with steps of the preset's snap, and
 * Move, which puts the move into the draft as a drag would. A start that is not a date and a time
 * keeps the dialog open with the error summary, which takes focus. Focus starts on the current
 * machine, and Cancel and Escape close without a change.
 */
export function MoveDialog({ open, row, finalFocus, onCancel, ...props }: MoveDialogProps) {
  return (
    <Dialog
      open={open && row !== undefined}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent
        data-move-dialog
        showCloseButton={false}
        initialFocus={() =>
          document.querySelector<HTMLElement>(
            '[data-move-dialog] [role="radio"][aria-checked="true"]',
          )
        }
        finalFocus={() => finalFocus() ?? undefined}
        className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-160"
      >
        {row !== undefined && <MoveForm key={row.id} row={row} onCancel={onCancel} {...props} />}
      </DialogContent>
    </Dialog>
  );
}
