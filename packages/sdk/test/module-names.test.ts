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

  it('E02-S01 the remote name of production-start is productionStart', () => {
    expect(moduleNames('production-start').remote).toBe('productionStart');
  });

  it('E02-S01 ids Planning, -a, a- and a--b are rejected', () => {
    for (const id of ['Planning', '-a', 'a-', 'a--b']) {
      expect(() => moduleNames(id), id).toThrow(`Invalid module id "${id}"`);
    }
  });

  it('E02-S01 an id whose owner role would exceed 63 bytes is rejected, naming the id', () => {
    // 57 characters, so the owner role nm_mod_<sql> is 64 bytes.
    const id = 'production-start-with-a-very-long-name-for-the-owner-role';

    expect(id).toHaveLength(57);
    expect(() => moduleNames(id)).toThrow(`Invalid module id "${id}"`);
    expect(() => moduleNames(id)).toThrow('63 bytes');
  });
});
