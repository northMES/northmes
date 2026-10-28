// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatDuration, formatPlantDay } from '@northmes/contracts/format';
import { useEffect, useId, useRef, useState } from 'react';
import { Temporal } from 'temporal-polyfill';
import { TextField } from '../../../../ui/components/text-field/index.ts';
import { TextareaField } from '../../../../ui/components/textarea-field/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
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
import type { CustomerOrderLine, GanttSnapshot } from '../../gantt-data.ts';
import { saveReason } from '../../mock-reasons.ts';
import { plantTime } from '../../order-facts.ts';
import { quantityText } from '../gantt/gantt-rows.ts';
import { type SupplyCandidate, supplyCandidates } from './customer-order-facts.ts';

export interface CustomerOrderSupplyDialogProps {
  readonly snapshot: GanttSnapshot;
  /** The line to supply; the dialog is closed while there is none. */
  readonly line: CustomerOrderLine | undefined;
  /** The name of the plant that delivers the line. */
  readonly plantName: string;
  /** The element that has focus once the step closes: the line's Supply from an order. */
  readonly returnFocus: () => HTMLElement | null;
  readonly onClose: () => void;
}

/** "14 days" or "1 day". */
function daysText(days: number): string {
  return days === 1 ? '1 day' : `${days} days`;
}

/** How long the outcome waits after a change before the announcer says it: typing has paused. */
const settleMs = 500;

/**
 * Says the outcome, or why the quantity is refused, through the app's announcer when it changes and
 * then holds for a moment, so typing a quantity says the last message once. The message the dialog
 * opens with is not said: the dialog is read as a whole.
 */
function useAnnouncedChange(message: string | undefined): void {
  const said = useRef(message);
  useEffect(() => {
    if (message === said.current) return;
    if (message === undefined) {
      said.current = undefined;
      return;
    }
    const timer = setTimeout(() => {
      said.current = message;
      announce(message);
    }, settleMs);
    return () => clearTimeout(timer);
  }, [message]);
}

interface OutcomeText {
  /** What the picked order then supplies. */
  readonly supplies: string;
  /** What that does to the plan. */
  readonly effect: string;
}

/** What the picked order supplies after the change, and what that does to the plan (KO3). */
function outcomeText(
  snapshot: GanttSnapshot,
  line: CustomerOrderLine,
  candidate: SupplyCandidate,
  quantity: number,
): OutcomeText {
  const { order } = candidate;
  const analysis = snapshot.analysis.orders[order.id];
  const days = Temporal.PlainDate.from(order.deadlineDate).until(line.wantedDate).days;
  const deadline = plantTime(snapshot, order.deadlineMs);
  const rest = candidate.free - quantity;
  // A line is late when the order that supplies it is late, the rule of every list (#728).
  const consequence = analysis?.late
    ? `Order ${order.number} is late by ${formatDuration(-analysis.slackElapsedS)}: it ends ${
        analysis.plannedEndMs === undefined ? 'later' : plantTime(snapshot, analysis.plannedEndMs)
      }, after its deadline ${deadline}, so the line is late too. Nothing moves on the plan.`
    : days >= 0
      ? `Its deadline stays ${deadline}, ${daysText(days)} before the wanted date, so nothing moves on the plan.`
      : `Its deadline stays ${deadline}, ${daysText(-days)} after the wanted date. Nothing moves on the plan.`;
  return {
    supplies: `Order ${order.number} then supplies ${quantityText(quantity)} to this line${
      rest > 0 ? ` and ${quantityText(rest)} to stock` : ''
    }`,
    effect: `${consequence}${candidate.stock ? ' It is no longer a stock order.' : ''}`,
  };
}

function Outcome({ supplies, effect }: OutcomeText) {
  return (
    <div
      data-supply-outcome
      className="grid gap-0.5 rounded-md border border-info bg-info-subtle p-3"
    >
      <b className="font-medium">{supplies}</b>
      <span>{effect}</span>
    </div>
  );
}

/**
 * The Supply from an order step of a line without a production order (design #728, KO3): the
 * open orders of the line's article at the delivering plant with quantity free, the quantity, what
 * the picked order then supplies, and the reason. Supply from order and New production order wait
 * for the planning server (planning.setProductionOrderDemand), so the step shows what would happen
 * and writes nothing.
 */
export function CustomerOrderSupplyDialog({
  snapshot,
  line,
  plantName,
  returnFocus,
  onClose,
}: CustomerOrderSupplyDialogProps) {
  return (
    <Dialog
      open={line !== undefined}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-xl"
        // Opened from the URL there is no trigger to return to, so focus goes to the line's button.
        finalFocus={() => returnFocus() ?? true}
      >
        {line !== undefined && (
          <SupplyStep snapshot={snapshot} line={line} plantName={plantName} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SupplyStep({
  snapshot,
  line,
  plantName,
  onClose,
}: {
  readonly snapshot: GanttSnapshot;
  readonly line: CustomerOrderLine;
  readonly plantName: string;
  readonly onClose: () => void;
}) {
  // The snapshot holds this plant's orders; a line another plant delivers has none here.
  const candidates =
    line.deliveringPlant === undefined || line.deliveringPlant === snapshot.plant.slug
      ? supplyCandidates(snapshot, line)
      : [];
  const legendId = useId();
  const [picked, setPicked] = useState(candidates[0]?.order.id);
  const [quantity, setQuantity] = useState(String(line.quantity));
  const [reason, setReason] = useState('');
  const candidate = candidates.find((each) => each.order.id === picked);
  const parsed = /^\d+$/.test(quantity.trim()) ? Number(quantity.trim()) : Number.NaN;
  const valid = Number.isInteger(parsed) && parsed > 0 && parsed <= line.quantity;
  const fits = valid && candidate !== undefined && parsed <= candidate.free;
  const outcome = fits ? outcomeText(snapshot, line, candidate, parsed) : undefined;
  // The field's error is no live region, so the step announces a refusal as it does the outcome.
  const refusal = !valid
    ? `Enter a whole number from 1 to ${line.quantity}.`
    : candidate !== undefined && !fits
      ? `Order ${candidate.order.number} has ${quantityText(candidate.free)} free.`
      : undefined;
  useAnnouncedChange(outcome === undefined ? refusal : `${outcome.supplies}. ${outcome.effect}`);
  return (
    <>
      <DialogHeader>
        <DialogTitle>Supply line {line.line} from a production order</DialogTitle>
        <DialogDescription>
          {`Line ${line.line} of customer order ${line.customerOrder}: ${line.article}, ${quantityText(line.quantity)}, wanted ${formatPlantDay(line.wantedDate)}. `}
          {candidates.length === 0
            ? `No production order of ${line.article} at ${plantName} has quantity free.`
            : `Production orders of ${line.article} at ${plantName} with quantity free:`}
        </DialogDescription>
      </DialogHeader>
      {candidates.length > 0 && candidate !== undefined && (
        <div className="grid gap-4">
          <fieldset className="grid gap-2">
            <legend id={legendId} className="sr-only">
              Production order
            </legend>
            <RadioGroup
              aria-labelledby={legendId}
              value={picked}
              onValueChange={(value) => setPicked(value as string)}
            >
              {candidates.map((each) => {
                const id = `supply-${each.order.id}`;
                return (
                  <label
                    key={each.order.id}
                    htmlFor={id}
                    className="grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-1 rounded-md border border-border p-3 has-data-checked:border-foreground"
                  >
                    <RadioGroupItem id={id} value={each.order.id} className="mt-0.5" />
                    <span className="grid gap-0.5">
                      <span>
                        <b className="font-mono font-semibold">Order {each.order.number}</b>
                        {`, ${quantityText(each.order.quantity)}, ${each.stock ? 'stock order, ' : ''}${quantityText(each.free)} free`}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {`Deadline ${plantTime(snapshot, each.order.deadlineMs)}, planned end ${
                          snapshot.analysis.orders[each.order.id]?.plannedEndMs === undefined
                            ? 'Not placed'
                            : plantTime(
                                snapshot,
                                snapshot.analysis.orders[each.order.id]?.plannedEndMs ?? 0,
                              )
                        }`}
                      </span>
                    </span>
                  </label>
                );
              })}
            </RadioGroup>
          </fieldset>
          <TextField
            label={`Quantity from order ${candidate.order.number} (pcs)`}
            inputMode="numeric"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            hint={`At most ${quantityText(line.quantity)}, the open quantity of the line.`}
            {...(refusal !== undefined && { error: refusal })}
          />
          {outcome !== undefined && <Outcome {...outcome} />}
          <TextareaField
            label="Reason"
            optional
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            placeholder="Why you made this change"
            hint={`Shown in the history of the customer order and of order ${candidate.order.number}. Do not enter personal data. Up to 500 characters.`}
          />
        </div>
      )}
      <p className="text-xs text-muted-foreground">{saveReason}</p>
      <DialogFooter>
        <Button variant="outline" className="sm:me-auto" disabled>
          New production order for {quantityText(line.quantity)}
        </Button>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        {candidate !== undefined && (
          <Button disabled>Supply from order {candidate.order.number}</Button>
        )}
      </DialogFooter>
    </>
  );
}
