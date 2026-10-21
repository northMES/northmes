// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import { planningLinks } from '@northmes/planning-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { Building2, Info, Lock, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ErrorSummary, type SummaryError } from '../../../../ui/components/error-summary/index.ts';
import { FormActions } from '../../../../ui/components/form-actions/index.ts';
import { FormSection } from '../../../../ui/components/form-section/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { ReadOnlyField } from '../../../../ui/components/read-only-field/index.ts';
import { SelectField } from '../../../../ui/components/select-field/index.ts';
import { TextField } from '../../../../ui/components/text-field/index.ts';
import { UnsavedChangesGuard } from '../../../../ui/components/unsaved-changes-guard/index.ts';
import { fieldId } from '../../../../ui/lib/field-id.ts';
import { Alert, AlertDescription, AlertTitle } from '../../../../ui/primitives/alert.tsx';
import { Button, buttonVariants } from '../../../../ui/primitives/button.tsx';
import { Skeleton } from '../../../../ui/primitives/skeleton.tsx';
import { useEnteredOrdersStore } from '../../entered-orders-store.ts';
import type { GanttSnapshot } from '../../gantt-data.ts';
import {
  customerOrderNumberTaken,
  nextCustomerOrderNumber,
  ordersWithFree,
} from '../../new-order-facts.ts';
import { newCustomerOrderSearch } from '../../new-order-search.ts';
import { usePlanningSnapshot } from '../../use-planning-snapshot.ts';

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

/** Whether text is a real plant date, "2026-11-27". */
function validDate(text: string): boolean {
  if (!isoDate.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(text);
}

/** A positive number as typed, or undefined. */
function positive(text: string): number | undefined {
  const trimmed = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return undefined;
  const number = Number(trimmed);
  return number > 0 ? number : undefined;
}

/** The supply of a line in the form: none, an open order's number, or a new production order. */
type Supply = '' | 'new' | string;

interface LineDraft {
  /** A key that stays with the line while lines above it are removed. */
  readonly key: number;
  readonly article: string;
  readonly quantity: string;
  readonly wantedDate: string;
  readonly supply: Supply;
}

interface Draft {
  readonly number: string;
  readonly customer: string;
  readonly reference: string;
  readonly lines: readonly LineDraft[];
}

const emptyLine = (key: number): LineDraft => ({
  key,
  article: '',
  quantity: '',
  wantedDate: '',
  supply: '',
});

/** What a field needs, by its field name (`order.number`, `line.1.quantity`). */
function errorsOf(draft: Draft, snapshot: GanttSnapshot): Map<string, string> {
  const errors = new Map<string, string>();
  const number = draft.number.trim();
  if (number === '') errors.set('order.number', 'Enter a number for the customer order.');
  else if (customerOrderNumberTaken(snapshot, number)) {
    errors.set('order.number', `Customer order ${number} exists. Choose another number.`);
  }
  if (draft.customer === '') errors.set('order.customer', 'Choose a customer.');
  if (draft.lines.length === 0) errors.set('order.lines', 'Add at least one line.');
  draft.lines.forEach((line, index) => {
    const n = index + 1;
    if (line.article === '') errors.set(`line.${n}.article`, `Line ${n}: choose an article.`);
    if (positive(line.quantity) === undefined) {
      errors.set(`line.${n}.quantity`, `Line ${n}: enter a quantity greater than 0.`);
    }
    if (!validDate(line.wantedDate)) {
      errors.set(`line.${n}.wantedDate`, `Line ${n}: enter the wanted date as YYYY-MM-DD.`);
    }
  });
  return errors;
}

/** The form of a loaded page (NC1, NC2, NC6). */
function NewCustomerOrderForm({
  snapshot,
  plant,
}: {
  readonly snapshot: GanttSnapshot;
  readonly plant: string;
}) {
  const store = useEnteredOrdersStore();
  const navigate = useNavigate();
  const initial = useMemo<Draft>(
    () => ({
      number: nextCustomerOrderNumber(snapshot),
      customer: '',
      reference: '',
      lines: [emptyLine(1)],
    }),
    [snapshot],
  );
  const [draft, setDraft] = useState<Draft>(initial);
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [submits, setSubmits] = useState(0);
  /** Where the page goes once the order is created. */
  const [target, setTarget] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (target !== undefined) void navigate({ to: target });
  }, [target, navigate]);
  const plantName = snapshot.plants?.find((each) => each.slug === plant)?.name ?? plant;
  const articles = [...new Set((snapshot.routings ?? []).map((routing) => routing.article))];
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const setLine = (key: number, change: Partial<LineDraft>) =>
    setDraft((current) => ({
      ...current,
      lines: current.lines.map((line) => (line.key === key ? { ...line, ...change } : line)),
    }));

  const create = () => {
    const found = errorsOf(draft, snapshot);
    setErrors(found);
    setSubmits((count) => count + 1);
    if (found.size > 0) return;
    const number = draft.number.trim();
    store.addCustomerOrder({
      number,
      customerCode: draft.customer,
      customersReference: draft.reference.trim(),
      lines: draft.lines.map((line, index) => ({
        line: index + 1,
        article: line.article,
        quantity: positive(line.quantity) ?? 0,
        wantedDate: line.wantedDate,
        supply: line.supply === '' || line.supply === 'new' ? null : line.supply,
      })),
      createdAtMs: Date.now(),
      createdBy: 'You',
    });
    const first = draft.lines.findIndex((line) => line.supply === 'new');
    // The guard lets the form go once the order exists; the effect below then leaves.
    setTarget(
      first < 0
        ? planningLinks.customerOrders.customerOrder({ plant, customerOrderId: number }).href
        : planningLinks.orders.new({ plant }, { line: `${number}-${first + 1}` }).href,
    );
  };

  const summary: SummaryError[] = [...errors].map(([name, message]) => ({
    name,
    fieldId: fieldId(name),
    message,
  }));

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        create();
      }}
    >
      <UnsavedChangesGuard when={dirty && target === undefined} />
      <ErrorSummary
        heading={`${summary.length} ${summary.length === 1 ? 'field needs' : 'fields need'} a change`}
        errors={summary}
        focusKey={submits}
      />
      <Alert>
        <Info aria-hidden />
        <AlertTitle>Source NorthMES</AlertTitle>
        <AlertDescription>
          A customer order entered here keeps every field editable after you create it. A customer
          order from the ERP keeps the read-only rules of the customer order page. On mock data it
          stays in this browser tab until a reload.
        </AlertDescription>
      </Alert>
      <FormSection title="Customer order">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Number"
            name="order.number"
            value={draft.number}
            error={errors.get('order.number')}
            onChange={(event) => setDraft({ ...draft, number: event.target.value })}
            hint="Unique in the company."
          />
          <SelectField
            label="Customer"
            name="order.customer"
            value={draft.customer}
            placeholder="Choose a customer"
            error={errors.get('order.customer')}
            options={(snapshot.customers ?? []).map((customer) => ({
              value: customer.code,
              label: `${customer.name}, ${customer.code}`,
            }))}
            onChange={(event) => setDraft({ ...draft, customer: event.target.value })}
            hint="Customers come from the ERP."
          />
          <TextField
            label="Customer's reference"
            name="order.reference"
            optional
            value={draft.reference}
            onChange={(event) => setDraft({ ...draft, reference: event.target.value })}
            hint="The customer's own order number."
          />
          <ReadOnlyField
            label="Delivering plant"
            value={plantName}
            tag="This plant"
            hint="The plant you work in delivers the lines."
          />
        </div>
      </FormSection>
      <FormSection
        title="Lines"
        description="Supply lists the open orders of the line's article with enough quantity free. A line supplied by a new production order opens New production order with it after you create the customer order."
      >
        {errors.has('order.lines') && (
          <p id={fieldId('order.lines')} tabIndex={-1} className="text-sm text-destructive">
            {errors.get('order.lines')}
          </p>
        )}
        <ol className="flex flex-col gap-4">
          {draft.lines.map((line, index) => {
            const n = index + 1;
            const quantity = positive(line.quantity) ?? 0;
            const open =
              line.article === '' ? [] : ordersWithFree(snapshot, line.article, quantity);
            return (
              <li
                key={line.key}
                className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_8rem_10rem_minmax(0,1.4fr)_auto] lg:items-start"
              >
                <SelectField
                  label={`Article of line ${n}`}
                  name={`line.${n}.article`}
                  value={line.article}
                  placeholder="Choose an article"
                  error={errors.get(`line.${n}.article`)}
                  options={articles.map((article) => ({ value: article, label: article }))}
                  onChange={(event) =>
                    setLine(line.key, { article: event.target.value, supply: '' })
                  }
                />
                <TextField
                  label={`Quantity of line ${n}, pcs`}
                  name={`line.${n}.quantity`}
                  inputMode="decimal"
                  value={line.quantity}
                  error={errors.get(`line.${n}.quantity`)}
                  onChange={(event) => setLine(line.key, { quantity: event.target.value })}
                />
                <TextField
                  label={`Wanted date of line ${n}`}
                  name={`line.${n}.wantedDate`}
                  value={line.wantedDate}
                  placeholder="YYYY-MM-DD"
                  error={errors.get(`line.${n}.wantedDate`)}
                  onChange={(event) => setLine(line.key, { wantedDate: event.target.value })}
                />
                <SelectField
                  label={`Supply of line ${n}`}
                  name={`line.${n}.supply`}
                  value={line.supply}
                  options={[
                    { value: '', label: 'Not supplied' },
                    ...open.map(({ order, free }) => ({
                      value: order.number,
                      label: `Order ${order.number}, ${free} pcs free`,
                    })),
                    { value: 'new', label: 'New production order after creating' },
                  ]}
                  onChange={(event) => setLine(line.key, { supply: event.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="lg:mt-6"
                  aria-label={`Remove line ${n}`}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      lines: draft.lines.filter((each) => each.key !== line.key),
                    })
                  }
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            );
          })}
        </ol>
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setDraft({
                ...draft,
                lines: [
                  ...draft.lines,
                  emptyLine(Math.max(0, ...draft.lines.map((line) => line.key)) + 1),
                ],
              })
            }
          >
            <Plus aria-hidden />
            Add line
          </Button>
        </div>
      </FormSection>
      <FormActions
        saveLabel="Create customer order"
        saving={false}
        cancelHref={planningLinks.customerOrders({ plant }).href}
        dirty={dirty}
      />
    </form>
  );
}

/**
 * New customer order (design #768, NC1 to NC7): a customer order entered by hand, with source
 * NorthMES, its customer from the ERP's customers, the plant in the URL as the delivering plant,
 * and lines with their supply: an open order with quantity free, a new production order after
 * creating, or none. Plan 07 has no command that creates a customer order yet; on mock data the
 * order goes to the in-memory store the plan's pages load with. The preview key opens the
 * loading, no customers, failed and no-access states.
 */
export function NewCustomerOrderScreen() {
  const { plant } = useShell();
  const search = newCustomerOrderSearch(useSearch({ strict: false }));
  const { snapshot, error, retry } = usePlanningSnapshot();
  let state: PageState = { status: 'ready' };
  if (search.preview === 'forbidden') {
    state = {
      status: 'empty',
      icon: Lock,
      title: 'You need the permission to create customer orders',
      description:
        'Creating a customer order needs a permission at the company. Ask your company admin for a role that holds it.',
    };
  } else if (search.preview === 'error' || (snapshot === undefined && error !== undefined)) {
    state = {
      status: 'error',
      title: 'Could not load the form',
      error: error ?? new Error('Previewed failure'),
      onRetry: retry,
    };
  } else if (search.preview === 'loading' || snapshot === undefined) {
    state = { status: 'loading' };
  } else if (search.preview === 'empty' || (snapshot.customers ?? []).length === 0) {
    state = {
      status: 'empty',
      icon: Building2,
      title: 'No customers yet',
      description:
        'A customer order needs a customer, and the company has none. Customers come from the ERP; the first import brings them.',
      action: (
        <Link
          to={coreLinks.customers({ plant }).href}
          className={buttonVariants({ variant: 'outline' })}
        >
          Go to customers
        </Link>
      ),
    };
  }
  return (
    <PageFrame
      title="New customer order"
      crumbs={[{ label: 'Customer orders', href: planningLinks.customerOrders({ plant }).href }]}
      state={state}
    >
      {state.status === 'loading' && (
        <div className="grid gap-4">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
          <p className="text-sm text-muted-foreground">Loading customers and articles</p>
        </div>
      )}
      {state.status === 'ready' && snapshot !== undefined && (
        <NewCustomerOrderForm snapshot={snapshot} plant={plant} />
      )}
    </PageFrame>
  );
}
