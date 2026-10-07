// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { serverArgs } from '../src/server-settings.ts';

describe('serverArgs', () => {
  it('serverArgs defaults to UTC', () => {
    expect(serverArgs({})).toEqual(['postgres', '-c', 'timezone=UTC']);
  });

  it('serverArgs treats an empty NM_TEST_PG_TZ as UTC', () => {
    const utc = ['postgres', '-c', 'timezone=UTC'];

    expect(serverArgs({ NM_TEST_PG_TZ: '' })).toEqual(utc);
    expect(serverArgs({ NM_TEST_PG_TZ: '  ' })).toEqual(utc);
  });

  it('serverArgs sets timezone from NM_TEST_PG_TZ', () => {
    expect(serverArgs({ NM_TEST_PG_TZ: 'Europe/Stockholm' })).toEqual([
      'postgres',
      '-c',
      'timezone=Europe/Stockholm',
    ]);
  });
});
