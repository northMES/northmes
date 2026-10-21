// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatPlantDateTime, formatPlantDay } from '@northmes/contracts/format';
import { Temporal } from 'temporal-polyfill';
import type { InventorySnapshot, MovementKind, PlannedMovement } from './inventory-data.ts';

// What the stock pages (design #729) and the material warning write of quantities, dates and
// movements, in one place.

/** The minus sign the stock pages write before a negative quantity. */
const minus = '−';

/** "92", "−26" or "0,085" as plain digits: a quantity without its unit. */
export function amountText(quantity: number): string {
  return quantity < 0 ? `${minus}${-quantity}` : String(quantity);
}

/** "92 m" or "−26 m". */
export function quantityWithUnit(quantity: number, unit: string): string {
  return `${amountText(quantity)} ${unit}`;
}

/** "+20 m" or "−36 m": a movement's signed quantity. */
export function signedQuantity(quantity: number, unit: string): string {
  return quantity > 0 ? `+${quantity} ${unit}` : quantityWithUnit(quantity, unit);
}

/** The plant date of an instant, "2026-11-05". */
export function plantDateOf(epochMs: number, timeZone: string): string {
  return Temporal.Instant.fromEpochMilliseconds(epochMs)
    .toZonedDateTimeISO(timeZone)
    .toPlainDate()
    .toString();
}

/** "Tue 3 Nov" for a movement dated by plant date only, "Wed 4 Nov 08:00" for one with a time. */
export function whenText(epochMs: number, dateOnly: boolean, timeZone: string): string {
  return dateOnly
    ? formatPlantDay(plantDateOf(epochMs, timeZone))
    : formatPlantDateTime(epochMs, timeZone);
}

/** "Mon 2 Nov 06:40" in plant time. */
export function stockTime(snapshot: InventorySnapshot, epochMs: number): string {
  return formatPlantDateTime(epochMs, snapshot.plant.timeZone);
}

const kindLabels: Readonly<Record<MovementKind, string>> = {
  purchase: 'Purchase',
  purchaseRequisition: 'Purchase requisition',
  transferIn: 'Transfer in',
  transferOut: 'Transfer out',
  consumption: 'Consumption',
  output: 'Output',
  customerDemand: 'Customer demand',
};

/** The kind of a movement in words. */
export function kindLabel(kind: MovementKind): string {
  return kindLabels[kind];
}

/** "+120 m, Mon 9 Nov": the next incoming movement as the Stock page's last column says it. */
export function incomingText(movement: PlannedMovement, unit: string, timeZone: string): string {
  return `${signedQuantity(movement.quantity, unit)}, ${whenText(movement.atMs, movement.dateOnly, timeZone)}`;
}
