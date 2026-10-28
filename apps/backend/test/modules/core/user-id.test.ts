// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import { userIdOf } from '../../../src/modules/core/core/commands/create-user.handler.ts';

describe('userIdOf', () => {
  // The first 16 bytes of SHA-256 over the namespace 6b1f0c2e9d4a4f53a1c7e8b25d3f9a60 and the
  // command id, with the version nibble set to 4 and the variant bits to 10, so Better Auth keeps
  // the id (ADR 0012).
  it('E05-S08 derives the user id a9b29b30-576b-4baf-bf23-17a7809b203c from the command id 01920000-0000-7000-8000-000000000001, whatever its case', () => {
    expect(userIdOf('01920000-0000-7000-8000-000000000001')).toBe(
      'a9b29b30-576b-4baf-bf23-17a7809b203c',
    );
    expect(userIdOf('01920000-0000-7000-8000-000000000001'.toUpperCase())).toBe(
      'a9b29b30-576b-4baf-bf23-17a7809b203c',
    );
  });

  it('E05-S08 another command id gives another user id', () => {
    expect(userIdOf('01920000-0000-7000-8000-000000000002')).not.toBe(
      'a9b29b30-576b-4baf-bf23-17a7809b203c',
    );
  });
});
