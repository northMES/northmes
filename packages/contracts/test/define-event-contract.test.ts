// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { defineEventContract } from '@northmes/contracts';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

describe('defineEventContract', () => {
  it('E05-S09 an accepted event contract keeps its name, version and entity, and its data schema parses the event data and refuses other data', () => {
    const contract = defineEventContract({
      name: 'core.article.created',
      version: 1,
      entity: 'core.article',
      data: z.object({ code: z.string() }),
    });

    expect(contract).toMatchObject({
      name: 'core.article.created',
      version: 1,
      entity: 'core.article',
    });
    expect(contract.data.parse({ code: 'HG-520' })).toEqual({ code: 'HG-520' });
    expect(contract.data.safeParse({ code: 520 }).success).toBe(false);
  });

  it('E05-S09 an event whose name is not its entity and a past-tense verb, or whose version is not a positive integer, is refused', () => {
    const data = z.object({});

    expect(() =>
      defineEventContract({ name: 'core.created', version: 1, entity: 'core.article', data }),
    ).toThrow(
      'Event core.created must be named <entity>.<what happened>, such as core.article.created',
    );
    expect(() =>
      defineEventContract({
        name: 'core.article.created',
        version: 0,
        entity: 'core.article',
        data,
      }),
    ).toThrow('Event core.article.created needs a schema version of 1 or more');
  });
});
