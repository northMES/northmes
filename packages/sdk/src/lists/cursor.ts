// SPDX-License-Identifier: MIT
import { DomainError } from '../errors/domain-error.ts';

/** The first element of every cursor: the version of the cursor format (ADR 0016). */
const CURSOR_FORMAT = 1;

/**
 * The opaque cursor of a row: base64url of the JSON array [1, orderSignature, ...sortValues], where
 * the sort values are the row's values of the order's keys as Postgres text, the id last
 * (ADR 0016).
 */
export function encodeCursor(signature: string, values: readonly string[]): string {
  return Buffer.from(JSON.stringify([CURSOR_FORMAT, signature, ...values])).toString('base64url');
}

/** The refusal of a cursor that this list and order did not write. */
function invalidCursor(): DomainError {
  return new DomainError({
    code: 'core.list.invalid_cursor',
    kind: 'validation',
    message: 'The cursor does not belong to this list and order. Start again from the first page.',
  });
}

/**
 * The sort values of a cursor that encodeCursor wrote for the order with `signature` and `count`
 * keys. Anything else, such as a cursor of the same list under another orderBy, is refused with
 * core.list.invalid_cursor.
 */
export function decodeCursor(cursor: string, signature: string, count: number): string[] {
  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw invalidCursor();
  }
  if (
    !Array.isArray(decoded) ||
    decoded.length !== count + 2 ||
    decoded[0] !== CURSOR_FORMAT ||
    decoded[1] !== signature ||
    !decoded.slice(2).every((value) => typeof value === 'string')
  ) {
    throw invalidCursor();
  }
  return decoded.slice(2);
}
