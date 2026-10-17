// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import { Secret } from '../../../src/modules/core/core/access/secret.ts';

describe('Secret', () => {
  const value = 'nms_int_QwErTyUiOpAsDfGhJkLzXcVbNm';

  it('ADR0073-W4 a record that holds a secret reads as [redacted] in JSON, text and util.inspect, and only reveal() returns the value', () => {
    const record = { name: 'ERP import', secret: new Secret(value) };

    expect(JSON.stringify(record)).toBe('{"name":"ERP import","secret":"[redacted]"}');
    expect(`${record.secret}`).toBe('[redacted]');
    expect(String(record.secret)).toBe('[redacted]');
    expect(inspect(record)).not.toContain(value);
    expect(record.secret.reveal()).toBe(value);
  });
});
