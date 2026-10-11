// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { formatQuantity } from '../../../src/ui/lib/quantity.ts';

describe('formatQuantity', () => {
  it("E02-S05 a quantity shows in the locale's digits and separators, without trailing zeros", () => {
    expect(formatQuantity('1200.000000', 'en-US')).toBe('1,200');
    expect(formatQuantity('12.500000', 'en-US')).toBe('12.5');
    expect(formatQuantity('1200.000000', 'sv-SE')).toBe('1 200');
    expect(formatQuantity('12.500000', 'de-DE')).toBe('12,5');
  });

  it('E02-S05 a quantity keeps every decimal the API sends, also beyond the precision of a number', () => {
    expect(formatQuantity('0.000001', 'en-US')).toBe('0.000001');
    expect(formatQuantity('123456789012.123456', 'en-US')).toBe('123,456,789,012.123456');
  });

  it('E02-S05 a value that is not a decimal shows as the API sent it', () => {
    expect(formatQuantity('n/a', 'en-US')).toBe('n/a');
  });
});
