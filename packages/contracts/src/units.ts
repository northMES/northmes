// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { z } from 'zod';

/** A physical dimension of the catalog; each has one canonical unit (ADR 0023). */
export type Dimension = 'count' | 'length' | 'mass' | 'volume';

/**
 * A unit of the NorthMES unit catalog (ADR 0023). Its code is stable: rows store it and GraphQL
 * names it as an enum value, so a code never changes. A value in the unit converts to the
 * dimension's canonical unit as `(value + shift) x num / den`; the canonical unit has scale 1 and
 * shift 0.
 */
export interface Unit {
  readonly code: string;
  readonly dimension: Dimension;
  /** The unit's name, plural, as a label reads it: Pieces. */
  readonly name: string;
  /** The symbol after a value: pcs. */
  readonly symbol: string;
  /** The label of a choice of unit: Pieces (pcs). */
  readonly label: string;
  /** The exact scale to the canonical unit, as numerator and denominator. */
  readonly num: number;
  readonly den: number;
  /** Added before scaling, for absolute temperatures; 0 elsewhere. */
  readonly shift: number;
  /** The UNECE Recommendation 20 code, which OPC UA uses. */
  readonly unece: string;
  /** The UCUM code. */
  readonly ucum: string;
  /** The decimals a formatter shows at most. */
  readonly decimals: number;
}

function unit(fields: Omit<Unit, 'label' | 'shift'> & { readonly shift?: number }): Unit {
  return { shift: 0, ...fields, label: `${fields.name} (${fields.symbol})` };
}

/**
 * The catalog, so far the stock units of articles and the canonical units of their dimensions.
 * Time, ratio and the cycle-time rates join with cycle time (E06-S01).
 */
export const unitCatalog: readonly Unit[] = [
  unit({
    code: 'PIECE',
    dimension: 'count',
    name: 'Pieces',
    symbol: 'pcs',
    num: 1,
    den: 1,
    unece: 'H87',
    ucum: '{piece}',
    decimals: 0,
  }),
  unit({
    code: 'METRE',
    dimension: 'length',
    name: 'Metres',
    symbol: 'm',
    num: 1,
    den: 1,
    unece: 'MTR',
    ucum: 'm',
    decimals: 3,
  }),
  unit({
    code: 'KILOGRAM',
    dimension: 'mass',
    name: 'Kilograms',
    symbol: 'kg',
    num: 1,
    den: 1,
    unece: 'KGM',
    ucum: 'kg',
    decimals: 3,
  }),
  unit({
    code: 'CUBIC_METRE',
    dimension: 'volume',
    name: 'Cubic metres',
    symbol: 'm³',
    num: 1,
    den: 1,
    unece: 'MTQ',
    ucum: 'm3',
    decimals: 3,
  }),
  unit({
    code: 'LITRE',
    dimension: 'volume',
    name: 'Litres',
    symbol: 'l',
    num: 1,
    den: 1000,
    unece: 'LTR',
    ucum: 'L',
    decimals: 3,
  }),
];

/**
 * The units an article's quantities can be counted in, its stock unit (ADR 0023). Quantities are
 * business quantities in this unit, never converted.
 */
export const stockUnitCodes = ['PIECE', 'METRE', 'KILOGRAM', 'LITRE'] as const;

export type StockUnitCode = (typeof stockUnitCodes)[number];

/** A stock unit's code, refused with the article form's message when it is not one (ui-222). */
export const stockUnit = z.enum(stockUnitCodes, { error: 'Choose a stock unit.' });

/** The stock unit an article gets when nobody chose one, as ADR 0023 gives imported articles. */
export const DEFAULT_STOCK_UNIT: StockUnitCode = 'PIECE';

const byCode = new Map(unitCatalog.map((each) => [each.code, each]));

/** The catalog's unit with this code. A code the catalog does not hold throws. */
export function unitOf(code: string): Unit {
  const found = byCode.get(code);
  if (!found) throw new Error(`The unit catalog has no unit ${code}`);
  return found;
}
