// SPDX-License-Identifier: AGPL-3.0-or-later
import { getConfig } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('the web test setup', () => {
  it('E04-S01 a findBy query waits up to 5 s, so a test on a loaded machine does not fail at 1 s', () => {
    expect(getConfig().asyncUtilTimeout).toBe(5000);
  });
});
