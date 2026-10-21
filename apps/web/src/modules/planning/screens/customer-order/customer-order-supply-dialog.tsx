// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatPlantDay } from '@northmes/contracts/format';
import { useId, useState } from 'react';
import { Temporal } from 'temporal-polyfill';
import { TextField } from '../../../../ui/components/text-field/index.ts';
import { TextareaField } from '../../../../ui/components/textarea-field/index.ts';
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
  readonly onClose: () => void;
}

/** "14 days" or "1 day". */
function daysText(days: number): string {
  return days === 1 ? '1 day' : `${days} days`;
}

/** What the picked order supplies after the change, and what that does to the plan (KO3). */
function Outcome({
  snapshot,
  line,
  candidate,
  quantity,
}: {
  readonly snapshot: GanttSnapshot;
  readonly line: CustomerOrderLine;
  readonly candidate: SupplyCandidate;
  readonly quantity: number;
}) {
  const { order } = candidate;
  const days = Temporal.PlainDate.from(order.deadlineDate).until(line.wantedDate).days;
  const deadline = plantTime(snapshot, order.deadlineMs);
  const rest = candidate.free - quantity;
  return (
    <div role="status" className="grid gap-0.5 rounded-md border border-info bg-info-subtle p-3">
      <b className="font-medium">
        Order {order.number} then supplies {quantityText(quantity)} to this line
        {rest > 0 ? ` and ${quantityText(rest)} to stock` : ''}
      </b>
      <span>
        {days >= 0
          ? `Its deadline stays ${deadline}, ${daysText(days)} before the wanted date, so nothing moves on the plan.`
          : `Its deadline stays ${deadline}, ${daysText(-days)} after the wanted date, so the line would be late. Nothing moves on the plan.`}
        {candidate.stock && ' It is no longer a stock order.'}
      </span>
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
  onClose,
}: CustomerOrderSupplyDialogProps) {
  return (
    <Dialog
      open={line !== undefined}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-xl">
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
  const candidates = supplyCandidates(snapshot, line);
  const legendId = useId();
  const [picked, setPicked] = useState(candidates[0]?.order.id);
  const [quantity, setQuantity] = useState(String(line.quantity));
  const [reason, setReason] = useState('');
  const candidate = candidates.find((each) => each.order.id === picked);
  const parsed = /^\d+$/.test(quantity.trim()) ? Number(quantity.trim()) : Number.NaN;
  const valid = Number.isInteger(parsed) && parsed > 0 && parsed <= line.quantity;
  const fits = valid && candidate !== undefined && parsed <= candidate.free;
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
            {...(!valid && {
              error: `Enter a whole number from 1 to ${line.quantity}.`,
            })}
            {...(valid &&
              !fits && {
                error: `Order ${candidate.order.number} has ${quantityText(candidate.free)} free.`,
              })}
          />
          {fits && (
            <Outcome snapshot={snapshot} line={line} candidate={candidate} quantity={parsed} />
          )}
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
