// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { createUser, resetPassword } from '../src/index.ts';

const id = '019a0000-0000-7000-8000-000000000001';

/** The messages of a failed parse of createUser's input, by field. */
function messagesOf(input: Record<string, unknown>) {
  const result = createUser.input.safeParse({
    id,
    name: 'Tove Lindqvist',
    email: 'tove@example.test',
    username: 't.lindqvist',
    ...input,
  });
  return result.success ? [] : result.error.issues.map(({ path, message }) => ({ path, message }));
}

describe('the user contracts', () => {
  it('E05-S08 an empty username reads "Enter a username." and nothing else', () => {
    expect(messagesOf({ username: '  ' })).toEqual([
      { path: ['username'], message: 'Enter a username.' },
    ]);
    expect(messagesOf({ username: 'ab' })).toEqual([
      { path: ['username'], message: 'A username can be 3 to 30 characters.' },
    ]);
  });

  it('E05-S08 createUser takes an optional role and place and a reason of at most 500 characters', () => {
    expect(
      messagesOf({
        roleId: '019a0000-0000-7000-8000-000000000002',
        scopeId: '019a0000-0000-7000-8000-000000000003',
        reason: 'Starts on Monday',
      }),
    ).toEqual([]);
    expect(messagesOf({ reason: 'x'.repeat(501) }).map(({ path }) => path)).toEqual([['reason']]);
  });

  it('E05-S08 resetPassword takes the user and an optional reason', () => {
    expect(resetPassword.input.safeParse({ id, reason: 'Forgot it' }).success).toBe(true);
    expect(resetPassword.input.safeParse({ id, reason: 'x'.repeat(501) }).success).toBe(false);
  });
});
