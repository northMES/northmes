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
import { announce } from '../../../../ui/lib/announce.ts';
import { fieldId } from '../../../../ui/lib/field-id.ts';
import { Alert, AlertDescription, AlertTitle } from '../../../../ui/primitives/alert.tsx';
import { Button, buttonVariants } from '../../../../ui/primitives/button.tsx';
import { Skeleton } from '../../../../ui/primitives/skeleton.tsx';
import { useEnteredOrdersStore } from '../../entered-orders-store.ts';
import type { GanttSnapshot } from '../../gantt-data.ts';
import {
  customerOrderNumberTaken,
  nextCustomerOrderNumber,
  orderNumberProblem,
  ordersWithFree,
  validPlantDate,
  wholePieces,
} from '../../new-order-facts.ts';
import { newCustomerOrderSearch } from '../../new-order-search.ts';
import { usePlanningSnapshot } from '../../use-planning-snapshot.ts';

/** The supply of a line in the form: none, an open order's number, or a new production order. */
type Supply = '' | 'new' | string;

interface LineDraft {
  /** A key that stays with the line while lines above it are removed; fields are named by it. */
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

/** One line as the form stands for it: its open orders to pick from and the supply that holds. */
interface LineView {
  readonly line: LineDraft;
  readonly open: readonly { readonly order: { readonly number: string }; readonly free: number }[];
  /** The line's supply, or Not supplied when the order it named no longer has the quantity free. */
  readonly supply: Supply;
}

/**
 * Each line with the orders it may take from, after what the lines above it take: two lines can
 * never share more than an order has free (#768).
 */
function lineViews(draft: Draft, snapshot: GanttSnapshot): readonly LineView[] {
  const taken = new Map<string, number>();
  return draft.lines.map((line) => {
    const quantity = wholePieces(line.quantity) ?? 0;
    const open = line.article === '' ? [] : ordersWithFree(snapshot, line.article, quantity, taken);
    const holds =
      line.supply === '' ||
      line.supply === 'new' ||
      open.some(({ order }) => order.number === line.supply);
    const supply = holds ? line.supply : '';
    if (supply !== '' && supply !== 'new') {
      taken.set(supply, (taken.get(supply) ?? 0) + quantity);
    }
    return { line, open, supply };
  });
}

/** What a field needs, by its field name (`order.number`, `line.<key>.quantity`). */
function errorsOf(
  draft: Draft,
  views: readonly LineView[],
  snapshot: GanttSnapshot,
): Map<string, string> {
  const errors = new Map<string, string>();
  const number = draft.number.trim();
  const numberProblem = orderNumberProblem(number);
  if (number === '') errors.set('order.number', 'Enter a number for the customer order.');
  else if (customerOrderNumberTaken(snapshot, number)) {
    errors.set('order.number', `Customer order ${number} exists. Choose another number.`);
  } else if (numberProblem !== undefined) errors.set('order.number', numberProblem);
  if (draft.customer === '') errors.set('order.customer', 'Choose a customer.');
  if (draft.lines.length === 0) errors.set('order.lines', 'Add at least one line.');
  else if (views.filter((view) => view.supply === 'new').length > 1) {
    errors.set(
      'order.lines',
      'Only one line can open New production order after creating. Supply the others from the customer order page.',
    );
  }
  views.forEach(({ line }, index) => {
    const n = index + 1;
    if (line.article === '')
      errors.set(`line.${line.key}.article`, `Line ${n}: choose an article.`);
    if (wholePieces(line.quantity) === undefined) {
      errors.set(
        `line.${line.key}.quantity`,
        `Line ${n}: enter whole pieces greater than 0, digits only.`,
      );
    }
    if (!validPlantDate(line.wantedDate)) {
      errors.set(`line.${line.key}.wantedDate`, `Line ${n}: enter the wanted date as YYYY-MM-DD.`);
    }
  });
  return errors;
}

/** The form of a loaded page (NC1, NC2, NC6). */
function NewCustomerOrderForm({
  snapshot,
  plant,
  saveFails,
}: {
  readonly snapshot: GanttSnapshot;
  readonly plant: string;
  /** The page previews a save that fails (NC6): the entries stay and the summary says so. */
  readonly saveFails: boolean;
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
  const [submits, setSubmits] = useState(0);
  const [saveFailed, setSaveFailed] = useState(false);
  /** Where the page goes once the customer order is created, in place of the form in the history. */
  const [target, setTarget] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (target !== undefined) void navigate({ to: target, replace: true });
  }, [target, navigate]);
  const plantName = snapshot.plants?.find((each) => each.slug === plant)?.name ?? plant;
  const articles = [...new Set((snapshot.routings ?? []).map((routing) => routing.article))];
  const views = lineViews(draft, snapshot);
  // After the first Create the errors follow the entries, so a fixed field loses its error at once.
  const errors = submits === 0 ? new Map<string, string>() : errorsOf(draft, views, snapshot);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const setLine = (key: number, change: Partial<LineDraft>) =>
    setDraft((current) => ({
      ...current,
      lines: current.lines.map((line) => (line.key === key ? { ...line, ...change } : line)),
    }));

  const create = () => {
    const found = errorsOf(draft, views, snapshot);
    setSubmits((count) => count + 1);
    setSaveFailed(false);
    if (found.size > 0) return;
    if (saveFails) {
      setSaveFailed(true);
      return;
    }
    const number = draft.number.trim();
    store.addCustomerOrder({
      plant,
      number,
      customerCode: draft.customer,
      customersReference: draft.reference.trim(),
      lines: views.map(({ line, supply }, index) => ({
        line: index + 1,
        article: line.article,
        quantity: wholePieces(line.quantity) ?? 0,
        wantedDate: line.wantedDate,
        supply: supply === '' || supply === 'new' ? null : supply,
      })),
      createdAtMs: Date.now(),
      createdBy: 'You',
    });
    announce(`Customer order ${number} created.`);
    const first = views.findIndex((view) => view.supply === 'new');
    // The guard lets the form go once the order exists; the effect above then leaves.
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
      {saveFailed && summary.length === 0 && (
        <ErrorSummary heading="Could not create the customer order" errors={[]} focusKey={submits}>
          <p>
            Your entries are kept. Try again; if it fails again, give your plant admin the
            correlation id.
          </p>
          <p className="font-mono">Correlation id 7f3a-2c91-0b78</p>
        </ErrorSummary>
      )}
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
            hint="Unique in the company. Letters, digits, - and _ only."
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
        description="Supply lists the open orders of the line's article with enough quantity free. One line may be supplied by a new production order, which opens with that line after you create the customer order."
      >
        {errors.has('order.lines') && (
          <p id={fieldId('order.lines')} tabIndex={-1} className="text-sm text-destructive">
            {errors.get('order.lines')}
          </p>
        )}
        <ol className="flex flex-col gap-4">
          {views.map(({ line, open, supply }, index) => {
            const n = index + 1;
            return (
              <li
                key={line.key}
                className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_8rem_10rem_minmax(0,1.4fr)_auto] lg:items-start"
              >
                <SelectField
                  label={`Article of line ${n}`}
                  name={`line.${line.key}.article`}
                  value={line.article}
                  placeholder="Choose an article"
                  error={errors.get(`line.${line.key}.article`)}
                  options={articles.map((article) => ({ value: article, label: article }))}
                  onChange={(event) =>
                    setLine(line.key, { article: event.target.value, supply: '' })
                  }
                />
                <TextField
                  label={`Quantity of line ${n}, pcs`}
                  name={`line.${line.key}.quantity`}
                  inputMode="numeric"
                  value={line.quantity}
                  error={errors.get(`line.${line.key}.quantity`)}
                  onChange={(event) => setLine(line.key, { quantity: event.target.value })}
                />
                <TextField
                  label={`Wanted date of line ${n}`}
                  name={`line.${line.key}.wantedDate`}
                  value={line.wantedDate}
                  placeholder="YYYY-MM-DD"
                  error={errors.get(`line.${line.key}.wantedDate`)}
                  onChange={(event) => setLine(line.key, { wantedDate: event.target.value })}
                />
                <SelectField
                  label={`Supply of line ${n}`}
                  name={`line.${line.key}.supply`}
                  value={supply}
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
 * loading, no customers, failed, failed save and no-access states.
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
        <NewCustomerOrderForm
          snapshot={snapshot}
          plant={plant}
          saveFails={search.preview === 'saveError'}
        />
      )}
    </PageFrame>
  );
}
