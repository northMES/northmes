// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import { stockUnit, stockUnitCodes, unitCatalog, unitOf } from '../src/units.ts';

describe('the unit catalog', () => {
  it('E06-S01 every code is unique and a valid GraphQL enum name', () => {
    const codes = unitCatalog.map(({ code }) => code);

    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).toMatch(/^[A-Z][A-Z0-9_]*$/);
  });

  it('E06-S01 every dimension has exactly one canonical unit, with scale 1 and shift 0', () => {
    const dimensions = new Set(unitCatalog.map(({ dimension }) => dimension));

    for (const dimension of dimensions) {
      const canonical = unitCatalog.filter(
        (unit) =>
          unit.dimension === dimension && unit.num === 1 && unit.den === 1 && unit.shift === 0,
      );
      expect(
        canonical.map(({ code }) => code),
        dimension,
      ).toHaveLength(1);
    }
  });

  it('E06-S01 a litre is exactly a thousandth of a cubic metre', () => {
    expect(unitOf('LITRE')).toMatchObject({ dimension: 'volume', num: 1, den: 1000, shift: 0 });
  });

  it('E06-S01 each unit carries its UNECE Recommendation 20 and UCUM codes', () => {
    expect(unitCatalog.map(({ code, unece, ucum }) => [code, unece, ucum])).toEqual([
      ['PIECE', 'H87', '{piece}'],
      ['METRE', 'MTR', 'm'],
      ['KILOGRAM', 'KGM', 'kg'],
      ['CUBIC_METRE', 'MTQ', 'm3'],
      ['LITRE', 'LTR', 'L'],
    ]);
  });

  it('E06-S06 an article counts its quantities in pieces, metres, kilograms or litres', () => {
    expect(stockUnitCodes).toEqual(['PIECE', 'METRE', 'KILOGRAM', 'LITRE']);
    expect(stockUnit.options).toEqual(stockUnitCodes);
    expect(stockUnitCodes.map((code) => unitOf(code).label)).toEqual([
      'Pieces (pcs)',
      'Metres (m)',
      'Kilograms (kg)',
      'Litres (l)',
    ]);
  });

  it("E06-S06 a stock unit that is not in the catalog is refused with the form's message", () => {
    const parsed = stockUnit.safeParse('GALLON');

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe('Choose a stock unit.');
  });
});
