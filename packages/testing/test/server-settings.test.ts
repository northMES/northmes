// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { serverArgs } from '../src/server-settings.ts';

describe('serverArgs', () => {
  it('serverArgs defaults to UTC', () => {
    expect(serverArgs({})).toContain('timezone=UTC');
  });

  it('serverArgs treats an empty NM_TEST_PG_TZ as UTC', () => {
    expect(serverArgs({ NM_TEST_PG_TZ: '' })).toContain('timezone=UTC');
    expect(serverArgs({ NM_TEST_PG_TZ: '  ' })).toContain('timezone=UTC');
  });

  it('serverArgs sets timezone from NM_TEST_PG_TZ', () => {
    expect(serverArgs({ NM_TEST_PG_TZ: 'Europe/Stockholm' })).toContain(
      'timezone=Europe/Stockholm',
    );
  });
});
