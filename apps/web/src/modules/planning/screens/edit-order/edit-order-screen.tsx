// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link, useParams } from '@tanstack/react-router';
import { Info, Lock } from 'lucide-react';
import { type ReactNode, useId } from 'react';
import { FormSection } from '../../../../ui/components/form-section/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { SelectField } from '../../../../ui/components/select-field/index.ts';
import { TextField } from '../../../../ui/components/text-field/index.ts';
import { TextareaField } from '../../../../ui/components/textarea-field/index.ts';
import { Alert, AlertDescription, AlertTitle } from '../../../../ui/primitives/alert.tsx';
import { Badge } from '../../../../ui/primitives/badge.tsx';
import { Button, buttonVariants } from '../../../../ui/primitives/button.tsx';
import { Field, FieldDescription, FieldLabel } from '../../../../ui/primitives/field.tsx';
import { Input } from '../../../../ui/primitives/input.tsx';
import type { GanttOrder, GanttSnapshot } from '../../gantt-data.ts';
import { saveReason } from '../../mock-reasons.ts';
import { orderById } from '../../order-facts.ts';
import { usePlanningSnapshot } from '../../use-planning-snapshot.ts';
import { quantityText } from '../gantt/gantt-rows.ts';
import { deadlineRuleText } from '../job-orders/job-orders-late-facts.tsx';

/** The order colors of the board, the palette tokens of D1 (ui-189). */
const colors = Array.from({ length: 8 }, (_, index) => `palette-${index + 1}`);

/**
 * A field the ERP owns on an imported order (PO5): read-only, with the From the ERP tag beside its
 * label, so the planner sees what the next import changes and what stays.
 */
function ErpField({
  label,
  value,
  hint,
}: {
  readonly label: string;
  readonly value: string;
  readonly hint: ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <Field>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FieldLabel htmlFor={id} className="block text-xs font-semibold text-foreground">
          {label}
        </FieldLabel>
        <Badge variant="outline" className="h-4.5 gap-1 px-1.5 text-[0.6875rem]">
          <Lock aria-hidden className="size-3" />
          From the ERP
        </Badge>
      </div>
      <Input
        id={id}
        readOnly
        aria-readonly
        value={value}
        aria-describedby={hintId}
        className="bg-muted"
      />
      <FieldDescription id={hintId}>{hint}</FieldDescription>
    </Field>
  );
}

/** The form of an order (PO4, PO5): the master fields, the planning fields and the reason. */
function OrderForm({
  snapshot,
  order,
}: {
  readonly snapshot: GanttSnapshot;
  readonly order: GanttOrder;
}) {
  const { plant } = useShell();
  const imported = order.origin?.owner !== 'northmes';
  const rule = deadlineRuleText(snapshot.settings);
  const articles = [...new Set((snapshot.routings ?? []).map((routing) => routing.article))];
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      {imported && (
        <Alert>
          <Info aria-hidden />
          <AlertTitle>Order {order.number} comes from the ERP</AlertTitle>
          <AlertDescription>
            The ERP owns article, quantity, deadline date and priority, so they are shown and change
            with the next import. The planning fields below are NorthMES's and are written back.
          </AlertDescription>
        </Alert>
      )}
      <FormSection title="Order">
        <div className="grid gap-4 sm:grid-cols-2">
          {imported ? (
            <>
              <ErpField
                label="Article"
                value={order.article}
                hint="The article as the ERP sent it."
              />
              <ErpField
                label="Quantity (pcs)"
                value={String(order.quantity)}
                hint="Changes with the next import."
              />
              <ErpField
                label="Deadline date, plant time"
                value={order.deadlineDate}
                hint={`The ERP sends the date only. The deadline rule sets the time: ${rule.charAt(0).toLowerCase()}${rule.slice(1)}.`}
              />
              <ErpField
                label="Priority"
                value={order.priority === null ? '' : String(order.priority)}
                hint="The ERP sends the priority. Field ownership is an open question with the product owner."
              />
            </>
          ) : (
            <>
              <SelectField
                label="Article"
                name="article"
                defaultValue={order.article}
                options={(articles.includes(order.article)
                  ? articles
                  : [order.article, ...articles]
                ).map((article) => ({ value: article, label: article }))}
                hint="The articles with a routing at this plant."
              />
              <TextField
                label="Quantity (pcs)"
                name="quantity"
                inputMode="numeric"
                defaultValue={String(order.quantity)}
                hint={`In the article's stock unit, pieces: ${quantityText(order.quantity)} now.`}
              />
              <TextField
                label="Deadline date, plant time"
                name="deadlineDate"
                defaultValue={order.deadlineDate}
                hint="Format YYYY-MM-DD, such as 2026-10-25. Weeks start on Monday."
              />
              <TextField
                label="Deadline time, plant time"
                name="deadlineTime"
                optional
                placeholder="15:00"
                hint={`Empty: the deadline rule of the plant applies, ${rule.charAt(0).toLowerCase()}${rule.slice(1)}.`}
              />
              <TextField
                label="Priority"
                name="priority"
                optional
                inputMode="numeric"
                defaultValue={order.priority === null ? '' : String(order.priority)}
                placeholder="None"
                hint="Lower numbers go first among orders with the same deadline. Empty sorts last."
              />
            </>
          )}
          <TextField
            label="Earliest start, plant time"
            name="earliestStart"
            optional
            placeholder="YYYY-MM-DD HH:MM"
            hint="No job order of this order starts before it: material arrival, a customer's release, a tooling date."
          />
          <SelectField
            label="Color on the board"
            name="color"
            defaultValue={order.color}
            options={(colors.includes(order.color) ? colors : [order.color, ...colors]).map(
              (color) => ({
                value: color,
                label: color,
              }),
            )}
            hint="Groups the order's blocks on the board and the Gantt. It never carries state."
          />
          <TextareaField
            label="Note"
            name="note"
            optional
            className="sm:col-span-2"
            placeholder="Shown on the order page and in the hover card"
            hint="Up to 500 characters. Do not enter personal data."
          />
        </div>
      </FormSection>
      <FormSection title="Reason for change">
        <TextareaField
          label="Reason"
          name="reason"
          placeholder="Why you made this change"
          hint="Shown in the order's history. Do not enter personal data. Up to 500 characters."
        />
      </FormSection>
      <div className="flex flex-wrap items-center gap-2 border-t border-border py-3">
        <Button type="submit" disabled>
          Save order
        </Button>
        <Link
          to={planningLinks.orders.order({ plant, orderId: order.id }).href}
          className={buttonVariants({ variant: 'outline' })}
        >
          Cancel
        </Link>
        <p className="text-sm text-muted-foreground">{saveReason}</p>
      </div>
    </form>
  );
}

/**
 * The edit form of a production order (design #686, PO4 and PO5; ui-222 DE7): on an order created
 * in NorthMES every field is the planner's; on an imported order the ERP's fields are read-only
 * with the From the ERP tag and the planning fields stay editable (plan 07, field ownership, the
 * working default). The form is drawn on the fixture; Save waits for the planning server.
 */
export function EditOrderScreen() {
  const { plant } = useShell();
  const { orderId = '' } = useParams({ strict: false });
  const { snapshot, error, retry } = usePlanningSnapshot();
  const order = snapshot === undefined ? undefined : orderById(snapshot, orderId);
  let state: PageState = { status: 'ready' };
  if (snapshot === undefined && error !== undefined) {
    state = { status: 'error', title: 'Could not load the order', error, onRetry: retry };
  } else if (snapshot === undefined) {
    state = { status: 'loading' };
  } else if (order === undefined) {
    state = {
      status: 'empty',
      title: 'This order does not exist or you cannot see it',
      description:
        'The link may be out of date, or the order belongs to a plant you have no role in.',
      action: (
        <Link
          to={planningLinks.jobOrders({ plant }).href}
          className={buttonVariants({ variant: 'outline' })}
        >
          Back to Job orders
        </Link>
      ),
    };
  }
  const loaded = snapshot !== undefined && order !== undefined;
  return (
    <PageFrame
      title={order === undefined ? 'Edit order' : `Edit order ${order.number}`}
      crumbs={
        order === undefined
          ? []
          : [
              {
                label: `Order ${order.number}`,
                href: planningLinks.orders.order({ plant, orderId: order.id }).href,
              },
            ]
      }
      currentCrumb="Edit"
      meta={
        loaded ? (
          <span className="text-sm text-muted-foreground">
            {order.article}, {quantityText(order.quantity)}
          </span>
        ) : undefined
      }
      state={state}
    >
      {loaded && <OrderForm snapshot={snapshot} order={order} />}
    </PageFrame>
  );
}
