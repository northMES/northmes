// SPDX-License-Identifier: MIT
import { API_MAJOR, apiPath } from '@northmes/contracts';
import { describe, expect, it } from 'vitest';

describe('apiPath', () => {
  it('E02-S03 API_MAJOR is 1 and apiPath for web/modules returns /api/v1/web/modules', () => {
    expect(API_MAJOR).toBe(1);
    expect(apiPath('web', 'modules')).toBe('/api/v1/web/modules');
  });

  it('E02-S03 apiPath keeps a segment with ? or # as one literal path segment', () => {
    const path = apiPath('web', 'item?draft=true', 'a#b');

    expect(path).toBe('/api/v1/web/item%3Fdraft%3Dtrue/a%23b');
    expect(new URL(path, 'http://localhost').pathname).toBe(path);
  });
});
