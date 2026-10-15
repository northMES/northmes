// SPDX-License-Identifier: MIT
import { defineEventContract } from '@northmes/contracts';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

describe('defineEventContract', () => {
  it('E05-S09 an event contract names the event, its schema version, its entity and its data', () => {
    const data = z.object({ code: z.string() });

    const contract = defineEventContract({
      name: 'core.article.created',
      version: 1,
      entity: 'core.article',
      data,
    });

    expect(contract).toEqual({
      name: 'core.article.created',
      version: 1,
      entity: 'core.article',
      data,
    });
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
