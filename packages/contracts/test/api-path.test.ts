// SPDX-License-Identifier: MIT
import { API_MAJOR, apiPath } from '@northmes/contracts';
import { describe, expect, it } from 'vitest';

describe('apiPath', () => {
  it('E02-S03 API_MAJOR is 1 and apiPath for web/modules returns /api/v1/web/modules', () => {
    expect(API_MAJOR).toBe(1);
    expect(apiPath('web', 'modules')).toBe('/api/v1/web/modules');
  });
});
