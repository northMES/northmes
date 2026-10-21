// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic

import { formatPlantDay } from '@northmes/contracts/format';
import { coreLinks } from '@northmes/core-contracts';
import { planningLinks } from '@northmes/planning-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { Info, Lock, Package, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ErrorSummary, type SummaryError } from '../../../../ui/components/error-summary/index.ts';
import { FormActions } from '../../../../ui/components/form-actions/index.ts';
import { FormSection } from '../../../../ui/components/form-section/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { SelectField } from '../../../../ui/components/select-field/index.ts';
import { TextField } from '../../../../ui/components/text-field/index.ts';
import { TextareaField } from '../../../../ui/components/textarea-field/index.ts';
import { UnsavedChangesGuard } from '../../../../ui/components/unsaved-changes-guard/index.ts';
import { fieldId } from '../../../../ui/lib/field-id.ts';
import { Alert, AlertDescription, AlertTitle } from '../../../../ui/primitives/alert.tsx';
import { Button, buttonVariants } from '../../../../ui/primitives/button.tsx';
import { Skeleton } from '../../../../ui/primitives/skeleton.tsx';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/primitives/table.tsx';
import { useEnteredOrdersStore } from '../../entered-orders-store.ts';
import type { CustomerOrderLine, GanttSnapshot } from '../../gantt-data.ts';
import { linesNeedingSupply, productionOrderNumberTaken } from '../../new-order-facts.ts';
import { newOrderSearch } from '../../new-order-search.ts';
import { usePlanningSnapshot } from '../../use-planning-snapshot.ts';

/** The order colors of the board, the palette tokens of D1 (ui-189). */
const colors = Array.from({ length: 8 }, (_, index) => `palette-${index + 1}`);

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const clock = /^([01]\d|2[0-3]):[0-5]\d$/;

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

interface Draft {
  readonly number: string;
  readonly article: string;
  readonly quantity: string;
  readonly deadlineDate: string;
  readonly deadlineTime: string;
  readonly priority: string;
  readonly color: string;
  readonly note: string;
  /** The ids of the customer order lines the order supplies. */
  readonly lines: readonly string[];
}

type FieldName =
  | 'number'
  | 'article'
  | 'quantity'
  | 'deadlineDate'
  | 'deadlineTime'
  | 'priority'
  | 'lines';

const labels: Record<FieldName, string> = {
  number: 'Number',
  article: 'Article',
  quantity: 'Quantity',
  deadlineDate: 'Deadline date',
  deadlineTime: 'Deadline time',
  priority: 'Priority',
  lines: 'Supplies',
};

/** The form's start: the next number, and the article, quantity and date of a line it supplies. */
function draftOf(number: string, line: CustomerOrderLine | undefined): Draft {
  return {
    number,
    article: line?.article ?? '',
    quantity: line === undefined ? '' : String(line.quantity),
    deadlineDate: line?.wantedDate ?? '',
    deadlineTime: '',
    priority: '',
    color: 'palette-8',
    note: '',
    lines: line === undefined ? [] : [line.id],
  };
}

/** What a field needs, for each field that does not hold (#768, NO4). */
function errorsOf(
  draft: Draft,
  snapshot: GanttSnapshot,
  plantName: string,
): Partial<Record<FieldName, string>> {
  const errors: Partial<Record<FieldName, string>> = {};
  const number = draft.number.trim();
  if (number === '') errors.number = 'Enter a number for the order.';
  else if (productionOrderNumberTaken(snapshot, number)) {
    errors.number = `Number ${number} is in use at ${plantName}. Choose another number.`;
  }
  if (draft.article === '') errors.article = 'Choose an article.';
  const quantity = positive(draft.quantity);
  if (quantity === undefined) errors.quantity = 'Enter a quantity greater than 0, such as 400.';
  if (!validDate(draft.deadlineDate)) {
    errors.deadlineDate = 'Enter the date as YYYY-MM-DD, such as 2026-11-27.';
  }
  if (draft.deadlineTime !== '' && !clock.test(draft.deadlineTime)) {
    errors.deadlineTime = 'Enter the time as HH:MM, such as 15:00, or leave it empty.';
  }
  if (draft.priority !== '' && !/^[1-9]\d{0,3}$/.test(draft.priority.trim())) {
    errors.priority = 'Enter a whole number of 1 or more, or leave it empty.';
  }
  const lines = (snapshot.customerOrderLines ?? []).filter((line) => draft.lines.includes(line.id));
  const other = lines.find((line) => line.article !== draft.article);
  if (other !== undefined && draft.article !== '') {
    errors.lines = `Line ${other.line} of ${other.customerOrder} is for ${other.article}, not ${draft.article}. Remove it or choose ${other.article}.`;
  } else if (quantity !== undefined) {
    const asked = lines.reduce((sum, line) => sum + line.quantity, 0);
    if (asked > quantity) {
      errors.lines = `The lines ask for ${asked} pcs, more than the order's ${quantity} pcs. Raise the quantity or remove a line.`;
    }
  }
  return errors;
}

/** The form of a loaded page (NO1, NO3, NO4). */
function NewOrderForm({
  snapshot,
  plant,
  line,
}: {
  readonly snapshot: GanttSnapshot;
  readonly plant: string;
  readonly line: CustomerOrderLine | undefined;
}) {
  const store = useEnteredOrdersStore();
  const navigate = useNavigate();
  const initial = useMemo(() => draftOf(store.nextProductionOrderNumber(), line), [store, line]);
  const [draft, setDraft] = useState<Draft>(initial);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [submits, setSubmits] = useState(0);
  /** Where the page goes once the order is created. */
  const [target, setTarget] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (target !== undefined) void navigate({ to: target });
  }, [target, navigate]);
  const [picked, setPicked] = useState('');
  const plantName = snapshot.plants?.find((each) => each.slug === plant)?.name ?? plant;
  const articles = [...new Set((snapshot.routings ?? []).map((routing) => routing.article))];
  const routing = snapshot.routings?.find((each) => each.article === draft.article);
  const machineName = (code: string) =>
    snapshot.equipment.find((machine) => machine.code === code)?.name ?? code;
  const customerName = (code: string) =>
    snapshot.customers?.find((customer) => customer.code === code)?.name ?? code;
  const chosen = (snapshot.customerOrderLines ?? []).filter((each) =>
    draft.lines.includes(each.id),
  );
  const candidates = draft.article === '' ? [] : linesNeedingSupply(snapshot, draft.article);
  const offered = candidates.filter((each) => !draft.lines.includes(each.id));
  const quantity = positive(draft.quantity);
  const asked = chosen.reduce((sum, each) => sum + each.quantity, 0);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const set = (change: Partial<Draft>) => setDraft((current) => ({ ...current, ...change }));

  const create = () => {
    const found = errorsOf(draft, snapshot, plantName);
    setErrors(found);
    setSubmits((count) => count + 1);
    if (Object.keys(found).length > 0 || quantity === undefined) return;
    const number = draft.number.trim();
    store.addProductionOrder({
      number,
      article: draft.article,
      quantity,
      deadlineDate: draft.deadlineDate,
      ...(draft.deadlineTime !== '' && { deadlineTime: draft.deadlineTime }),
      priority: draft.priority === '' ? null : Number(draft.priority),
      color: draft.color,
      ...(draft.note.trim() !== '' && { note: draft.note.trim() }),
      suppliedLines: draft.lines,
      createdAtMs: Date.now(),
      createdBy: 'You',
    });
    // The guard lets the form go once the order exists; the effect below then leaves.
    setTarget(planningLinks.orders.order({ plant, orderId: `po-${number}` }).href);
  };

  const summary: SummaryError[] = (Object.keys(labels) as FieldName[]).flatMap((name) => {
    const message = errors[name];
    return message === undefined
      ? []
      : [{ name: `order.${name}`, fieldId: fieldId(`order.${name}`), message }];
  });

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
          An order entered here keeps every field editable after you create it. An order from the
          ERP keeps the ERP's fields read-only, as on the order page. On mock data the order stays
          in this browser tab until a reload.
        </AlertDescription>
      </Alert>
      <FormSection title="Order">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextField
            label="Number"
            name="order.number"
            value={draft.number}
            error={errors.number}
            onChange={(event) => set({ number: event.target.value })}
            hint={`The next number of NorthMES's own series at ${plantName}, so it never meets an ERP number.`}
          />
          <SelectField
            label="Article"
            name="order.article"
            value={draft.article}
            placeholder="Choose an article"
            error={errors.article}
            options={articles.map((article) => ({ value: article, label: article }))}
            onChange={(event) => set({ article: event.target.value })}
            hint="Articles with an active routing."
          />
          <TextField
            label="Quantity (pcs)"
            name="order.quantity"
            inputMode="decimal"
            value={draft.quantity}
            error={errors.quantity}
            onChange={(event) => set({ quantity: event.target.value })}
            hint="In the article's stock unit, pieces."
          />
          <TextField
            label={`Deadline date, ${snapshot.plant.timeZone}`}
            name="order.deadlineDate"
            value={draft.deadlineDate}
            error={errors.deadlineDate}
            onChange={(event) => set({ deadlineDate: event.target.value })}
            hint={
              line === undefined
                ? 'Format YYYY-MM-DD. Weeks start on Monday.'
                : `From the wanted date of line ${line.line} of ${line.customerOrder}. Format YYYY-MM-DD.`
            }
          />
          <TextField
            label={`Deadline time, ${snapshot.plant.timeZone}`}
            name="order.deadlineTime"
            optional
            value={draft.deadlineTime}
            error={errors.deadlineTime}
            placeholder={snapshot.settings.shiftEndForDeadline}
            onChange={(event) => set({ deadlineTime: event.target.value })}
            hint="Empty: the plant's deadline rule sets the time."
          />
          <TextField
            label="Priority"
            name="order.priority"
            optional
            inputMode="numeric"
            value={draft.priority}
            error={errors.priority}
            placeholder="None"
            onChange={(event) => set({ priority: event.target.value })}
            hint="Lower numbers go first among orders with the same deadline. Empty sorts last."
          />
          <SelectField
            label="Color on the board"
            name="order.color"
            value={draft.color}
            options={colors.map((color) => ({ value: color, label: color }))}
            onChange={(event) => set({ color: event.target.value })}
            hint="Groups the order's blocks on the board and the Gantt. It never carries state."
          />
          <TextareaField
            label="Note"
            name="order.note"
            optional
            maxLength={500}
            value={draft.note}
            onChange={(event) => set({ note: event.target.value })}
            className="sm:col-span-2"
            hint="Up to 500 characters. Do not enter personal data."
          />
        </div>
      </FormSection>
      <FormSection
        title="Operations"
        description={
          routing === undefined
            ? 'Choose an article to see the operations its routing gives the order.'
            : `From routing ${routing.article}, version ${routing.version}. Read-only here.`
        }
      >
        {routing !== undefined && (
          <div className="overflow-x-auto">
            <Table>
              <TableCaption className="sr-only">Operations</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Operation</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Allowed machines</TableHead>
                  <TableHead>Default machine</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routing.operations.map((operation) => (
                  <TableRow key={operation.sequence}>
                    <TableCell className="font-mono">
                      {draft.number.trim() || 'New'}.{operation.sequence}
                    </TableCell>
                    <TableCell>{operation.name}</TableCell>
                    <TableCell>{operation.allowedEquipment.map(machineName).join(', ')}</TableCell>
                    <TableCell>{machineName(operation.allowedEquipment[0] ?? '')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </FormSection>
      <FormSection
        title="Supplies"
        description="An order without customer order lines is a stock order. Several lines of one article may share one order. Creating the order writes the demand (planning.setProductionOrderDemand)."
      >
        <p id={fieldId('order.lines')} tabIndex={-1} className="text-sm text-muted-foreground">
          {chosen.length === 0
            ? `No lines: a stock order${quantity === undefined ? '' : ` of ${quantity} pcs`}.`
            : `${asked} of ${quantity ?? asked} pcs go to customers, ${Math.max(0, (quantity ?? asked) - asked)} pcs to stock.`}
        </p>
        {errors.lines !== undefined && <p className="text-sm text-destructive">{errors.lines}</p>}
        {chosen.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableCaption className="sr-only">Supplies</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer order line</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Wanted</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chosen.map((each) => (
                  <TableRow key={each.id}>
                    <TableCell>
                      {each.customerOrder} line {each.line}
                    </TableCell>
                    <TableCell>{customerName(each.customerCode)}</TableCell>
                    <TableCell>{formatPlantDay(each.wantedDate)}</TableCell>
                    <TableCell className="text-right font-mono">{each.quantity} pcs</TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove line ${each.line} of ${each.customerOrder}`}
                        onClick={() => set({ lines: draft.lines.filter((id) => id !== each.id) })}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <SelectField
            label="Customer order line"
            value={picked}
            placeholder={
              draft.article === ''
                ? 'Choose an article first'
                : offered.length === 0
                  ? 'No line of this article needs supply'
                  : 'Choose a line'
            }
            disabled={offered.length === 0}
            options={offered.map((each) => ({
              value: each.id,
              label: `${each.customerOrder} line ${each.line}, ${customerName(each.customerCode)}, ${each.quantity} pcs wanted ${formatPlantDay(each.wantedDate)}`,
            }))}
            onChange={(event) => setPicked(event.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            disabled={picked === ''}
            onClick={() => {
              set({ lines: [...draft.lines, picked] });
              setPicked('');
            }}
          >
            <Plus aria-hidden />
            Add line
          </Button>
        </div>
      </FormSection>
      <FormSection title="Release">
        <p className="text-sm text-muted-foreground">
          {routing === undefined
            ? 'Creating the order releases it: release copies the routing and adds one job order per operation to the Gantt under Not placed.'
            : `Creating the order releases it: release copies routing ${routing.article}, version ${routing.version}, and adds ${routing.operations.length} ${routing.operations.length === 1 ? 'job order' : 'job orders'} to the Gantt under Not placed. Plan this order then places them.`}
        </p>
      </FormSection>
      <FormActions
        saveLabel="Create order"
        saving={false}
        cancelHref={planningLinks.orders({ plant }).href}
        dirty={dirty}
      />
    </form>
  );
}

/**
 * New production order (design #768, NO1 to NO9): an order entered by hand, with source NorthMES
 * and a number of NorthMES's own series, its operations from the article's routing, the customer
 * order lines it supplies, and release on create. Started from the production orders list, or
 * from a customer order line in the URL's `line`, whose article, quantity and wanted date it
 * takes. On mock data the order goes to the in-memory store the plan's pages load with. The
 * preview key opens the loading, no article, failed and no-access states.
 */
export function NewOrderScreen() {
  const { plant } = useShell();
  const search = newOrderSearch(useSearch({ strict: false }));
  const { snapshot, error, retry } = usePlanningSnapshot();
  const line = snapshot?.customerOrderLines?.find((each) => each.id === search.line);
  let state: PageState = { status: 'ready' };
  if (search.preview === 'forbidden') {
    state = {
      status: 'empty',
      icon: Lock,
      title: 'You need the permission to create production orders at this plant',
      description:
        'Creating a production order needs the permission planning.productionOrder:create. Ask your plant admin for a role that holds it.',
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
  } else if (search.preview === 'empty' || (snapshot.routings ?? []).length === 0) {
    state = {
      status: 'empty',
      icon: Package,
      title: 'No article can be ordered yet',
      description:
        'A production order needs an article with an active routing, and this plant has none. Articles and routings come from the ERP or are created under Master data.',
      action: (
        <Link
          to={coreLinks.articles({ plant }).href}
          className={buttonVariants({ variant: 'outline' })}
        >
          Go to articles
        </Link>
      ),
    };
  }
  return (
    <PageFrame
      title="New production order"
      crumbs={[{ label: 'Production orders', href: planningLinks.orders({ plant }).href }]}
      meta={
        <span className="text-sm text-muted-foreground">
          {line === undefined
            ? 'Started from the production orders list'
            : `Started from line ${line.line} of customer order ${line.customerOrder}`}
        </span>
      }
      state={state}
    >
      {state.status === 'loading' && (
        <div className="grid gap-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <p className="text-sm text-muted-foreground">Loading articles and customer order lines</p>
        </div>
      )}
      {state.status === 'ready' && snapshot !== undefined && (
        <NewOrderForm key={search.line ?? 'list'} snapshot={snapshot} plant={plant} line={line} />
      )}
    </PageFrame>
  );
}
