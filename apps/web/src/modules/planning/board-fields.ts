// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// Board fields (plan 07, Board settings; #762): which fields a job order block and its hover card
// show, as lists of field ids at company and plant scope. A field id names a NorthMES field
// (`article`), an ERP free-field key (`erp:DRAWING_REV`) or a module's contribution to the block
// fields slot (`slot:connector.erpChange`). The board and the order Gantt read the lists through
// effectiveBoardFields and draw them with blockLines and shownFields.
import { formatDuration, formatPlantDateTime } from '@northmes/contracts/format';
import type {
  GanttJobOrder,
  GanttOperation,
  GanttOrder,
  GanttSnapshot,
  JobOrderAnalysis,
} from './gantt-data.ts';

/** The field ids of a block and of its hover card, in order (plan 07, Settings). */
export interface BoardFieldLists {
  readonly block: readonly string[];
  readonly hover: readonly string[];
}

/** A block shows at most this many fields, so a full block never needs a third line (#762). */
export const maxBlockFields = 4;

/** The company's lists and each plant's own, by plant slug; a plant without a list uses the company's. */
export interface BoardFieldSettings {
  readonly company: BoardFieldLists;
  readonly plants: Readonly<
    Record<string, { readonly block?: readonly string[]; readonly hover?: readonly string[] }>
  >;
}

/** The lists a plant shows: its own where it set one, else the company's, list by list. */
export function effectiveBoardFields(settings: BoardFieldSettings, plant: string): BoardFieldLists {
  const own = settings.plants[plant];
  return {
    block: own?.block ?? settings.company.block,
    hover: own?.hover ?? settings.company.hover,
  };
}

/** What a field reads of a job order: the board and the Gantt both hand over these. */
export interface BoardFieldRow {
  readonly order: GanttOrder;
  readonly operation: GanttOperation;
  readonly jobOrder: GanttJobOrder;
  readonly analysis?: JobOrderAnalysis | undefined;
}

type MachineName = (code: string | undefined) => string;

/** A NorthMES field: its label, its value in the hover card, and its text on a block. */
interface CoreField {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly value: (
    row: BoardFieldRow,
    snapshot: GanttSnapshot,
    machineName: MachineName,
  ) => string | undefined;
  /** The text on a block, when it differs from the value. */
  readonly block?: (
    row: BoardFieldRow,
    snapshot: GanttSnapshot,
    machineName: MachineName,
  ) => string | undefined;
  /** Whether the block's name already says it, so a block field adds no words to the name. */
  readonly named?: boolean;
}

const at = (ms: number | undefined, snapshot: GanttSnapshot) =>
  ms === undefined ? undefined : formatPlantDateTime(ms, snapshot.plant.timeZone);

const coreFields: readonly CoreField[] = [
  {
    id: 'operation',
    label: 'Operation',
    description: 'The operation number and name',
    value: ({ operation }) => `${operation.sequence}, ${operation.name}`,
    block: ({ operation }) => operation.name,
    named: true,
  },
  {
    id: 'article',
    label: 'Article',
    description: 'The article the order makes',
    value: ({ order }) => order.article,
    named: true,
  },
  {
    id: 'quantity',
    label: 'Quantity',
    description: 'The job order quantity',
    value: ({ jobOrder }) => `${jobOrder.quantity} pcs`,
    named: true,
  },
  {
    id: 'machine',
    label: 'Machine',
    description: 'The machine the job order runs on',
    value: ({ jobOrder }, _snapshot, machineName) =>
      jobOrder.equipment === undefined ? undefined : machineName(jobOrder.equipment),
    named: true,
  },
  {
    id: 'setupStart',
    label: 'Setup start',
    description: 'When setup starts',
    value: ({ jobOrder }, snapshot) => at(jobOrder.placement?.setupStartMs, snapshot),
    block: ({ jobOrder }, snapshot) => {
      const text = at(jobOrder.placement?.setupStartMs, snapshot);
      return text === undefined ? undefined : `from ${text}`;
    },
    named: true,
  },
  {
    id: 'runStart',
    label: 'Run start',
    description: 'When the run starts after setup',
    value: ({ jobOrder }, snapshot) => at(jobOrder.placement?.runStartMs, snapshot),
    block: ({ jobOrder }, snapshot) => {
      const text = at(jobOrder.placement?.runStartMs, snapshot);
      return text === undefined ? undefined : `run from ${text}`;
    },
  },
  {
    id: 'end',
    label: 'End',
    description: 'When the job order ends',
    value: ({ jobOrder }, snapshot) => at(jobOrder.placement?.endMs, snapshot),
    block: ({ jobOrder }, snapshot) => {
      const text = at(jobOrder.placement?.endMs, snapshot);
      return text === undefined ? undefined : `ends ${text}`;
    },
    named: true,
  },
  {
    id: 'setupAndRun',
    label: 'Setup and run',
    description: 'The planned setup and run durations',
    // The retool a run saves stays in the words, as the Gantt's own Setup, run line says it.
    value: ({ jobOrder }, snapshot) => {
      const saved = snapshot.runs
        ?.flatMap((run) => run.savedSetups)
        .find((each) => each.jobOrderId === jobOrder.id);
      const setup = formatDuration(jobOrder.plannedSetupS);
      const run = formatDuration(jobOrder.plannedRunS);
      return saved === undefined
        ? `${setup}, ${run}`
        : `${setup}, retool saved by the run (${formatDuration(saved.setupS)}), ${run}`;
    },
    named: true,
  },
  {
    id: 'orderDeadline',
    label: 'Order deadline',
    description: 'The deadline of the production order',
    value: ({ order }, snapshot) => at(order.deadlineMs, snapshot),
    block: ({ order }, snapshot) => `due ${at(order.deadlineMs, snapshot)}`,
  },
  {
    id: 'lateBy',
    label: 'Late by',
    description: 'How late the order ends, in elapsed time',
    value: ({ order }, snapshot) => {
      const analysis = snapshot.analysis.orders[order.id];
      if (analysis === undefined) return undefined;
      return analysis.late ? formatDuration(-analysis.slackElapsedS) : 'Not late';
    },
    // The block's name already says "late by" among its state cues, and nothing when on time.
    named: true,
  },
  {
    id: 'freeFloat',
    label: 'Free float',
    description: 'How far the row can move later without moving another',
    value: ({ analysis }) => {
      const float = analysis?.float;
      if (float === undefined) return undefined;
      return float.freeFloatWorkingS === 0 ? '0' : formatDuration(float.freeFloatWorkingS);
    },
  },
  {
    id: 'status',
    label: 'Status',
    description: 'Planned, started or finished',
    value: ({ jobOrder }) => jobOrder.status.charAt(0).toUpperCase() + jobOrder.status.slice(1),
    named: true,
  },
  {
    id: 'customer',
    label: 'Customer',
    description: 'The customers of the order lines the order supplies',
    value: ({ order }, snapshot) => {
      const codes = (snapshot.customerOrderLines ?? [])
        .filter((line) => line.productionOrderId === order.id)
        .map((line) => line.customerCode);
      const names = [...new Set(codes)].map(
        (code) => snapshot.customers?.find((customer) => customer.code === code)?.name ?? code,
      );
      return names.length === 0 ? undefined : names.join(', ');
    },
  },
  {
    id: 'priority',
    label: 'Priority',
    description: 'The order priority',
    value: ({ order }) => (order.priority === null ? undefined : String(order.priority)),
  },
];

const coreById = new Map(coreFields.map((field) => [field.id, field]));

/** A field the board settings page offers, with where it comes from. */
export interface BoardFieldOption {
  readonly id: string;
  readonly label: string;
  readonly source: 'core' | 'erp' | 'module';
  /** The source as the page names it: NorthMES, ERP field or the contributing module. */
  readonly sourceLabel: string;
  readonly description: string;
}

/**
 * The fields the board settings page offers (#762, BF4): the NorthMES fields, the ERP keys found in
 * the snapshot's orders, each with a sample value and how many orders carry it, and the fields the
 * modules contribute to the block fields slot.
 */
export function boardFieldCatalog(snapshot: GanttSnapshot): {
  readonly core: readonly BoardFieldOption[];
  readonly erp: readonly BoardFieldOption[];
  readonly module: readonly BoardFieldOption[];
} {
  const orders = snapshot.productionOrders;
  const found = new Map<string, { sample: string; count: number }>();
  for (const order of orders) {
    for (const entry of order.externalData ?? []) {
      const known = found.get(entry.key);
      if (known === undefined) found.set(entry.key, { sample: entry.value, count: 1 });
      else known.count += 1;
    }
  }
  return {
    core: coreFields.map((field) => ({
      id: field.id,
      label: field.label,
      source: 'core',
      sourceLabel: 'NorthMES',
      description: field.description,
    })),
    erp: [...found].map(([key, { sample, count }]) => ({
      id: `erp:${key}`,
      label: key,
      source: 'erp',
      sourceLabel: 'ERP field',
      description: `${sample}, in ${count} of ${orders.length} orders`,
    })),
    module: (snapshot.moduleFields ?? []).map((field) => ({
      id: `slot:${field.id}`,
      label: field.label,
      source: 'module',
      sourceLabel: field.module,
      description: `From ${field.module}`,
    })),
  };
}

/** The catalog's three groups, as boardFieldCatalog answers them. */
export type BoardFieldCatalog = ReturnType<typeof boardFieldCatalog>;

/**
 * The option of a field id in a catalog, or an option that says its source is gone (#762, F0
 * question 5): blocks and the hover card skip such a field, and the page names it Not available.
 */
export function boardFieldOption(id: string, catalog: BoardFieldCatalog): BoardFieldOption {
  const known = [...catalog.core, ...catalog.erp, ...catalog.module].find(
    (option) => option.id === id,
  );
  if (known !== undefined) return known;
  const label = id.startsWith('erp:') ? id.slice(4) : id.startsWith('slot:') ? id.slice(5) : id;
  return {
    id,
    label,
    source: id.startsWith('erp:') ? 'erp' : id.startsWith('slot:') ? 'module' : 'core',
    sourceLabel: 'Not available',
    description: 'Its source no longer sends it; blocks and the hover card skip it.',
  };
}

/** A field as a block, the hover card or Details shows it for one job order. */
export interface ShownField {
  readonly id: string;
  readonly label: string;
  /** The value the hover card and Details list. */
  readonly value: string;
  /** The text on a block. */
  readonly text: string;
  /** The words the block's name adds for it; none when the name already says it. */
  readonly accessibleText?: string;
  /** A module's field, which a block draws at its trailing edge (D3 IN29). */
  readonly trailing: boolean;
}

function shownField(
  id: string,
  row: BoardFieldRow,
  snapshot: GanttSnapshot,
  machineName: MachineName,
): ShownField | undefined {
  if (id.startsWith('erp:')) {
    const key = id.slice(4);
    const value = row.order.externalData?.find((entry) => entry.key === key)?.value;
    if (value === undefined) return undefined;
    return {
      id,
      label: key,
      value,
      text: value,
      accessibleText: `${key} ${value}`,
      trailing: false,
    };
  }
  if (id.startsWith('slot:')) {
    const field = snapshot.moduleFields?.find((each) => each.id === id.slice(5));
    const value = field?.values[row.jobOrder.id];
    if (field === undefined || value === undefined) return undefined;
    return {
      id,
      label: field.label,
      value: value.hoverText,
      text: value.text,
      accessibleText: value.accessibleText,
      trailing: true,
    };
  }
  const field = coreById.get(id);
  const value = field?.value(row, snapshot, machineName);
  if (field === undefined || value === undefined) return undefined;
  const text = field.block?.(row, snapshot, machineName) ?? value;
  return {
    id,
    label: field.label,
    value,
    text,
    ...(field.named !== true && { accessibleText: `${field.label.toLowerCase()} ${value}` }),
    trailing: false,
  };
}

/** The fields of a list for one job order, in its order; a field without a value is skipped. */
export function shownFields(
  ids: readonly string[],
  row: BoardFieldRow,
  snapshot: GanttSnapshot,
  machineName: MachineName,
): ShownField[] {
  return ids.flatMap((id) => {
    const field = shownField(id, row, snapshot, machineName);
    return field === undefined ? [] : [field];
  });
}

/** What a block draws of its fields (D3 block density; #762, BF2). */
export interface BlockLines {
  /** The first field, beside the job number on the first line; compact blocks show it alone. */
  readonly first: string | undefined;
  /** The other fields on the second line, joined by commas. */
  readonly second: string;
  /** The module fields, drawn at the trailing edge after the state icons. */
  readonly trailing: readonly ShownField[];
  /** The words the block's name adds for fields it does not already say. */
  readonly extraNames: readonly string[];
}

/** The block lines of a job order from its block field ids. */
export function blockLines(
  ids: readonly string[],
  row: BoardFieldRow,
  snapshot: GanttSnapshot,
  machineName: MachineName,
): BlockLines {
  const fields = shownFields(ids.slice(0, maxBlockFields), row, snapshot, machineName);
  const inline = fields.filter((field) => !field.trailing);
  return {
    first: inline[0]?.text,
    second: inline
      .slice(1)
      .map((field) => field.text)
      .join(', '),
    trailing: fields.filter((field) => field.trailing),
    extraNames: fields.flatMap((field) =>
      field.accessibleText === undefined ? [] : [field.accessibleText],
    ),
  };
}
