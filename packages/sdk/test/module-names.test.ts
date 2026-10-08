// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { moduleNames } from '../src/module-names.ts';

describe('moduleNames', () => {
  it('E02-S01 production-start derives productionStart and production_start', () => {
    const names = moduleNames('production-start');

    expect(names.gql).toBe('productionStart');
    expect(names.sql).toBe('production_start');
  });

  it('E02-S01 the owner role of production-start is nm_mod_production_start', () => {
    expect(moduleNames('production-start').ownerRole).toBe('nm_mod_production_start');
  });
});
