// SPDX-License-Identifier: MIT
import { timestamp } from '@northmes/contracts';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

describe('timestamp', () => {
  it('ADR0073-W3 encodes a Date as an ISO 8601 string with an offset and decodes one back', () => {
    const at = new Date('2026-10-09T08:15:00.000Z');

    expect(z.encode(timestamp, at)).toBe('2026-10-09T08:15:00.000Z');
    expect(z.decode(timestamp, '2026-10-09T10:15:00+02:00')).toEqual(at);
    expect(timestamp.safeParse('2026-10-09').success).toBe(false);
    expect(z.toJSONSchema(timestamp, { io: 'input' })).toMatchObject({
      type: 'string',
      format: 'date-time',
    });
  });
});
