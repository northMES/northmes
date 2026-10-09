// SPDX-License-Identifier: MIT
import { API_MAJOR, apiPath } from '@northmes/contracts';
import { describe, expect, it } from 'vitest';

describe('apiPath', () => {
  it('E02-S03 API_MAJOR is 1 and apiPath for planning/orders returns /api/v1/planning/orders', () => {
    expect(API_MAJOR).toBe(1);
    expect(apiPath('planning', 'orders')).toBe('/api/v1/planning/orders');
  });

  it('E02-S03 apiPath keeps a segment with ? or # as one literal path segment', () => {
    const path = apiPath('web', 'item?draft=true', 'a#b');

    expect(path).toBe('/api/v1/web/item%3Fdraft%3Dtrue/a%23b');
    expect(new URL(path, 'http://localhost').pathname).toBe(path);
  });

  it('E02-S03 apiPath refuses an empty, . or .. segment, which URL parsing would drop or climb', () => {
    expect(new URL(`/api/v1/web/../modules`, 'http://localhost').pathname).toBe('/api/v1/modules');
    for (const segment of ['', '.', '..']) {
      expect(() => apiPath('web', segment, 'modules'), JSON.stringify(segment)).toThrow(
        `apiPath segment ${JSON.stringify(segment)} is not a path segment`,
      );
    }
  });
});
