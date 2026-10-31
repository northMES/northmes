// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import { DomainError, toDomainError } from '../../src/errors/index.ts';

/** A Postgres error as node-postgres reports it, with the fields toDomainError reads. */
function postgresError(code: string, constraint: string): Error {
  return Object.assign(new Error('conflicting key value violates exclusion constraint'), {
    code,
    constraint,
    // Postgres names the key only when the row is readable; under row-level security it says less.
    detail: 'Key conflicts with existing key.',
  });
}

describe('toDomainError', () => {
  it('E06-S04 an exclusion violation (23P01) of a constraint ending in _code_excl is core.code_taken on code, with a message that names no row', () => {
    const mapped = toDomainError(postgresError('23P01', 'equipment_group_code_excl'));

    expect(mapped).toBeInstanceOf(DomainError);
    expect(mapped).toMatchObject({
      code: 'core.code_taken',
      message: 'The code is already taken.',
      fieldErrors: [
        { path: ['code'], message: 'The code is already taken.', code: 'core.code_taken' },
      ],
    });
    expect((mapped as DomainError).getStatus()).toBe(409);
    expect((mapped as DomainError).details).toBeUndefined();
  });

  it('E06-S04 a unique violation (23505) of an index ending in _code_key stays core.code_taken', () => {
    expect(toDomainError(postgresError('23505', 'article_group_code_key'))).toMatchObject({
      code: 'core.code_taken',
    });
  });

  it.each([
    ['an exclusion violation of another constraint', '23P01', 'shift_period_excl'],
    [
      'an exclusion violation of a constraint that only contains _code_excl',
      '23P01',
      'x_code_excl_old',
    ],
    [
      'a unique violation of a constraint ending in _code_excl',
      '23505',
      'equipment_group_code_excl',
    ],
  ])('E06-S04 %s comes back as it is', (_case, code, constraint) => {
    const error = postgresError(code, constraint);

    expect(toDomainError(error)).toBe(error);
  });
});
