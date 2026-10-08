// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { BootError } from '../src/boot/boot-error.ts';
import { type CatalogEntry, checkCatalog } from '../src/catalog/check-catalog.ts';
import { core, imageVersion, inRepoModule, plugin } from './fixtures/catalog.ts';

// The BootError that checkCatalog throws for a catalog it refuses.
function refusal(entries: readonly CatalogEntry[]): BootError {
  try {
    checkCatalog(entries, { imageVersion });
  } catch (error) {
    if (error instanceof BootError) return error;
    throw error;
  }
  throw new Error('checkCatalog accepted the catalog');
}

describe('checkCatalog', () => {
  it('E02-S01 a missing dependency exits 1 naming both modules', () => {
    const error = refusal([core, inRepoModule('planning', ['core', 'quality'])]);
    const problem = 'Module planning depends on "quality", which is not installed';

    expect(error.exitCode).toBe(1);
    expect(error.problems).toEqual([problem]);
    expect(error.message).toContain(problem);
  });

  it('E02-S01 a core module that depends on a plugin is refused', () => {
    const error = refusal([
      core,
      inRepoModule('planning', ['core']),
      plugin('overtime-validator', ['planning']),
      inRepoModule('scheduling', ['planning', 'overtime-validator']),
    ]);

    expect(error.problems).toEqual([
      'Core module scheduling must not depend on plugin overtime-validator',
    ]);
  });
});
