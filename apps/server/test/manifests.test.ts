// SPDX-License-Identifier: AGPL-3.0-or-later
import core from '@northmes/module-core/manifest';
import { satisfies } from 'semver';
import { describe, expect, it } from 'vitest';

describe('core manifest', () => {
  it('E02-S01 core northmes range accepts image version 0.0.0', () => {
    expect(satisfies('0.0.0', core.northmes), core.northmes).toBe(true);
  });
});
