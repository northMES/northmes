// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The projected balance of an article at a plant (plan 07, Material warnings): the balance of the
// warehouses mapped to the plant, then every counted planned movement in order of its instant,
// incoming before outgoing at the same instant, then by id. A consumption that takes the balance
// below zero marks its job order material short. The planning server's projectMaterial() takes
// this place; the pages read the same shape from it.

import type {
  InventoryArticle,
  InventorySnapshot,
  InventoryWarehouse,
  PlannedMovement,
} from './inventory-data.ts';

/** A quantity rounded to the thousandth, so sums of decimal metres stay exact. */
function rounded(quantity: number): number {
  return Math.round(quantity * 1000) / 1000;
}

/** The warehouses the plant counts: those mapped to it, by code. */
export function plantWarehouses(snapshot: InventorySnapshot): InventoryWarehouse[] {
  return snapshot.warehouses
    .filter((warehouse) => warehouse.plant === snapshot.plant.slug)
    .sort((a, b) => a.code.localeCompare(b.code));
}

/** The balances of an article in the plant's warehouses, or in those picked, by warehouse. */
export function balancesOf(
  snapshot: InventorySnapshot,
  article: string,
  warehouses: readonly string[] = plantWarehouses(snapshot).map((each) => each.code),
) {
  const picked = new Set(warehouses);
  return snapshot.balances.filter((row) => row.article === article && picked.has(row.warehouse));
}

/** The order the projection takes movements in: instant, incoming first, then id. */
function compareMovements(a: PlannedMovement, b: PlannedMovement): number {
  if (a.atMs !== b.atMs) return a.atMs - b.atMs;
  const incoming = Number(b.quantity > 0) - Number(a.quantity > 0);
  if (incoming !== 0) return incoming;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** One movement of a projection with the balance after it; none for one that is not counted. */
export interface ProjectionStep {
  readonly movement: PlannedMovement;
  readonly balance: number | undefined;
}

export interface Projection {
  /** The balance of the counted warehouses when the ERP took it. */
  readonly start: number;
  readonly steps: readonly ProjectionStep[];
  /** The lowest balance and when it begins: the stock time when nothing goes lower. */
  readonly lowest: {
    readonly balance: number;
    readonly atMs: number;
    readonly dateOnly: boolean;
  };
}

/** The projected balance of an article over the plant's warehouses, or over those picked. */
export function projectionOf(
  snapshot: InventorySnapshot,
  article: string,
  warehouses: readonly string[] = plantWarehouses(snapshot).map((each) => each.code),
): Projection {
  const picked = new Set(warehouses);
  const start = rounded(
    balancesOf(snapshot, article, warehouses).reduce((sum, row) => sum + row.quantity, 0),
  );
  let balance = start;
  let lowest = { balance: start, atMs: snapshot.stockAsOfMs, dateOnly: false };
  const steps = snapshot.movements
    .filter((movement) => movement.article === article && picked.has(movement.warehouse))
    .sort(compareMovements)
    .map((movement) => {
      if (!movement.counted) return { movement, balance: undefined };
      balance = rounded(balance + movement.quantity);
      if (balance < lowest.balance) {
        lowest = { balance, atMs: movement.atMs, dateOnly: movement.dateOnly };
      }
      return { movement, balance };
    });
  return { start, steps, lowest };
}

/** Why an article falls below zero: a job order short of material, or a late order's output. */
export type ShortReason =
  | { readonly kind: 'material'; readonly movement: PlannedMovement }
  | {
      readonly kind: 'lateOrder';
      /** The demand that takes the balance below zero. */
      readonly movement: PlannedMovement;
      /** The output that brings it back, the late order. */
      readonly output: PlannedMovement | undefined;
    };

/** One row of the Stock page: an article with stock at the plant, and its projection (ST1). */
export interface StockRow {
  readonly article: InventoryArticle;
  readonly inStock: number;
  readonly projection: Projection;
  readonly lowest: Projection['lowest'];
  /** Why it falls below zero; none while it stays at zero or above. */
  readonly short?: ShortReason;
  /** The first counted incoming movement after it falls below zero. */
  readonly nextIncoming?: PlannedMovement;
}

/** The first step that takes the balance below zero, and the first incoming one after it. */
function belowZero(projection: Projection) {
  const index = projection.steps.findIndex(
    (step) => step.balance !== undefined && step.balance < 0,
  );
  if (index < 0) return undefined;
  const step = projection.steps[index];
  const next = projection.steps
    .slice(index + 1)
    .find((each) => each.balance !== undefined && each.movement.quantity > 0);
  return step === undefined ? undefined : { step, next: next?.movement };
}

/** The row of one article at the plant, over the picked warehouses. */
export function stockRowOf(
  snapshot: InventorySnapshot,
  article: InventoryArticle,
  warehouses?: readonly string[],
): StockRow {
  const projection = projectionOf(snapshot, article.number, warehouses);
  const below = belowZero(projection);
  let short: ShortReason | undefined;
  if (below !== undefined) {
    short =
      below.step.movement.kind === 'consumption'
        ? { kind: 'material', movement: below.step.movement }
        : { kind: 'lateOrder', movement: below.step.movement, output: below.next };
  }
  return {
    article,
    inStock: projection.start,
    projection,
    lowest: projection.lowest,
    ...(short !== undefined && { short }),
    ...(below?.next !== undefined && { nextIncoming: below.next }),
  };
}

/**
 * The rows of the Stock page (ST1): every article with a stock row in a counted warehouse,
 * materials first, then by the lowest projected balance, then by number.
 */
export function stockRows(snapshot: InventorySnapshot, warehouses?: readonly string[]): StockRow[] {
  const counted = new Set(warehouses ?? plantWarehouses(snapshot).map((each) => each.code));
  const numbers = new Set(
    snapshot.balances.filter((row) => counted.has(row.warehouse)).map((row) => row.article),
  );
  return snapshot.articles
    .filter((article) => numbers.has(article.number))
    .map((article) => stockRowOf(snapshot, article, warehouses))
    .sort(
      (a, b) =>
        Number(a.article.kind === 'finished') - Number(b.article.kind === 'finished') ||
        a.lowest.balance - b.lowest.balance ||
        a.article.number.localeCompare(b.article.number),
    );
}

/** A job order short of material (MW1, MW3): what it needs and how the projection gets there. */
export interface MaterialShortage {
  readonly jobOrder: NonNullable<PlannedMovement['jobOrder']>;
  readonly material: InventoryArticle;
  readonly movement: PlannedMovement;
  readonly need: number;
  /** The projected balance just before the consumption. */
  readonly before: number;
  readonly after: number;
  readonly shortfall: number;
  readonly warehouse: InventoryWarehouse;
  /** The counted movement before it, which set the balance it starts from. */
  readonly previous?: PlannedMovement;
  /** The first counted incoming movement after it. */
  readonly nextIncoming?: PlannedMovement;
}

/**
 * The job orders short of material (plan 07): each consumption whose step takes the plant's
 * projected balance of its material below zero marks the consuming operation's job order.
 */
export function materialShortages(snapshot: InventorySnapshot): MaterialShortage[] {
  const shortages: MaterialShortage[] = [];
  for (const material of snapshot.articles.filter((article) => article.kind === 'material')) {
    const projection = projectionOf(snapshot, material.number);
    let before = projection.start;
    let previous: PlannedMovement | undefined;
    projection.steps.forEach((step, index) => {
      if (step.balance === undefined) return;
      const { movement } = step;
      if (movement.kind === 'consumption' && step.balance < 0 && movement.jobOrder !== undefined) {
        const warehouse = snapshot.warehouses.find((each) => each.code === movement.warehouse);
        const next = projection.steps
          .slice(index + 1)
          .find((each) => each.balance !== undefined && each.movement.quantity > 0);
        if (warehouse !== undefined) {
          shortages.push({
            jobOrder: movement.jobOrder,
            material,
            movement,
            need: -movement.quantity,
            before,
            after: step.balance,
            shortfall: rounded(Math.min(-step.balance, -movement.quantity)),
            warehouse,
            ...(previous !== undefined && { previous }),
            ...(next !== undefined && { nextIncoming: next.movement }),
          });
        }
      }
      before = step.balance;
      previous = movement;
    });
  }
  return shortages;
}
