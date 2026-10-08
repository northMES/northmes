// SPDX-License-Identifier: MIT
import { randomUUIDv7 } from 'node:crypto';

/**
 * The scopes a test isolates itself in (ADR 0041). Each call returns a fresh uuidv7 scope id, and
 * no row exists for it.
 */
export const given = {
  plant: (): string => randomUUIDv7(),
};
