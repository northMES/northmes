// SPDX-License-Identifier: AGPL-3.0-or-later

/** A decimal as the API sends a numeric column, such as "1200.000000". */
const decimal = /^-?\d+(\.\d+)?$/;

/**
 * A quantity as the user reads it: the API's decimal string in the locale's digits and separators,
 * without trailing zeros, such as "1,200" in en-US and "1 200" in sv-SE. The string goes to
 * Intl.NumberFormat as it is, so no decimal is lost to the precision of a number. Without a locale
 * the browser's own applies. A value that is not a decimal shows unchanged.
 */
export function formatQuantity(quantity: string, locale?: string): string {
  if (!decimal.test(quantity)) return quantity;
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 20 }).format(
    quantity as Intl.StringNumericLiteral,
  );
}
