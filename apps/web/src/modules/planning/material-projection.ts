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

/**
 * A quantity rounded to the millionth, the scale of the plan's numeric(18,6) quantities, so a sum
 * of decimal metres stays exact: 1 200 × 0.085 m is 102 m, not 102.00000000000001.
 */
export function roundQuantity(quantity: number): number {
  return Math.round(quantity * 1_000_000) / 1_000_000;
}

/** Codes compare by code unit, the same in every browser. */
export function compareCodes(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The warehouses the plant counts: those mapped to it, by code. */
export function plantWarehouses(snapshot: InventorySnapshot): InventoryWarehouse[] {
  return snapshot.warehouses
    .filter((warehouse) => warehouse.plant === snapshot.plant.slug)
    .sort((a, b) => compareCodes(a.code, b.code));
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

/**
 * The order the projection takes movements in: instant, then for movements counted at now their
 * own date, then incoming first, then id.
 */
function compareMovements(a: PlannedMovement, b: PlannedMovement): number {
  if (a.atMs !== b.atMs) return a.atMs - b.atMs;
  const due = (a.dueMs ?? a.atMs) - (b.dueMs ?? b.atMs);
  if (due !== 0) return due;
  const incoming = Number(b.quantity > 0) - Number(a.quantity > 0);
  if (incoming !== 0) return incoming;
  return compareCodes(a.id, b.id);
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
  const start = roundQuantity(
    balancesOf(snapshot, article, warehouses).reduce((sum, row) => sum + row.quantity, 0),
  );
  let balance = start;
  let lowest = { balance: start, atMs: snapshot.stockAsOfMs, dateOnly: false };
  const steps = snapshot.movements
    .filter((movement) => movement.article === article && picked.has(movement.warehouse))
    .sort(compareMovements)
    .map((movement) => {
      if (!movement.counted) return { movement, balance: undefined };
      balance = roundQuantity(balance + movement.quantity);
      if (balance < lowest.balance) {
        lowest = { balance, atMs: movement.atMs, dateOnly: movement.dateOnly };
      }
      return { movement, balance };
    });
  return { start, steps, lowest };
}

/**
 * Why an article falls below zero at the plant: job orders short of material, a late order whose
 * output comes after the customer demand it supplies, or neither, such as a balance below zero
 * from the start.
 */
export type ShortReason =
  | { readonly kind: 'material'; readonly shortages: readonly MaterialShortage[] }
  | {
      readonly kind: 'lateOrder';
      /** The demand that takes the balance below zero. */
      readonly movement: PlannedMovement;
      /** The production order that supplies that demand. */
      readonly order: { readonly id: string; readonly number: string };
    }
  | { readonly kind: 'belowZero' };

/** One row of the Stock page: an article at the plant and its projection (ST1). */
export interface StockRow {
  readonly article: InventoryArticle;
  readonly inStock: number;
  /** The projection over the picked warehouses, which In stock, Lowest and At show. */
  readonly projection: Projection;
  readonly lowest: Projection['lowest'];
  /** Why it falls below zero over the whole plant; none while the plant stays at zero or above. */
  readonly short?: ShortReason;
  /** The first counted incoming movement after the plant's balance falls below zero. */
  readonly nextIncoming?: PlannedMovement;
}

/**
 * Where the balance first is below zero: -1 when it starts there, the index of the step that
 * takes it there, or undefined when it never is.
 */
function firstBelowZero(projection: Projection): number | undefined {
  if (projection.start < 0) return -1;
  const index = projection.steps.findIndex(
    (step) => step.balance !== undefined && step.balance < 0,
  );
  return index < 0 ? undefined : index;
}

/** Why the plant's balance of an article falls below zero, the verdict every filter keeps. */
function shortReasonOf(
  snapshot: InventorySnapshot,
  article: InventoryArticle,
  plant: Projection,
): ShortReason | undefined {
  if (plant.lowest.balance >= 0) return undefined;
  if (article.kind === 'material') {
    const shortages = materialShortages(snapshot).filter(
      (each) => each.material.number === article.number,
    );
    if (shortages.length > 0) return { kind: 'material', shortages };
  }
  const step = plant.steps[firstBelowZero(plant) ?? -1];
  const order = step?.movement.customerOrderLine?.productionOrder;
  if (step !== undefined && step.movement.kind === 'customerDemand' && order !== undefined) {
    return { kind: 'lateOrder', movement: step.movement, order };
  }
  return { kind: 'belowZero' };
}

/** The row of one article at the plant, In stock, Lowest and At over the picked warehouses. */
export function stockRowOf(
  snapshot: InventorySnapshot,
  article: InventoryArticle,
  warehouses?: readonly string[],
): StockRow {
  const projection = projectionOf(snapshot, article.number, warehouses);
  const plant = warehouses === undefined ? projection : projectionOf(snapshot, article.number);
  const short = shortReasonOf(snapshot, article, plant);
  const index = firstBelowZero(plant);
  const next =
    index === undefined
      ? undefined
      : plant.steps
          .slice(index + 1)
          .find((step) => step.balance !== undefined && step.movement.quantity > 0)?.movement;
  return {
    article,
    inStock: projection.start,
    projection,
    lowest: projection.lowest,
    ...(short !== undefined && { short }),
    ...(next !== undefined && { nextIncoming: next }),
  };
}

/**
 * Whether the plant holds the article: a balance row or a planned movement in its warehouses, or
 * in those picked.
 */
export function isAtPlant(
  snapshot: InventorySnapshot,
  article: string,
  warehouses: readonly string[] = plantWarehouses(snapshot).map((each) => each.code),
): boolean {
  const counted = new Set(warehouses);
  return (
    snapshot.balances.some((row) => row.article === article && counted.has(row.warehouse)) ||
    snapshot.movements.some(
      (movement) => movement.article === article && counted.has(movement.warehouse),
    )
  );
}

/**
 * The rows of the Stock page (ST1): every article with a balance row or a planned movement at
 * the plant, or in the picked warehouses, materials first, then by the lowest projected balance, then by number.
 */
export function stockRows(snapshot: InventorySnapshot, warehouses?: readonly string[]): StockRow[] {
  return snapshot.articles
    .filter((article) => isAtPlant(snapshot, article.number, warehouses))
    .map((article) => stockRowOf(snapshot, article, warehouses))
    .sort(
      (a, b) =>
        Number(a.article.kind === 'finished') - Number(b.article.kind === 'finished') ||
        a.lowest.balance - b.lowest.balance ||
        compareCodes(a.article.number, b.article.number),
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
            shortfall: roundQuantity(Math.min(-step.balance, -movement.quantity)),
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
