// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { serverArgs } from '../src/server-settings.ts';

describe('serverArgs', () => {
  it('serverArgs defaults to UTC', () => {
    expect(serverArgs({})).toEqual(['postgres', '-c', 'timezone=UTC']);
  });
});
