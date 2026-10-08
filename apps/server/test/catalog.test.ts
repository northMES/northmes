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

  it('E02-S01 a cycle is refused naming every module in it', () => {
    const error = refusal([
      core,
      inRepoModule('planning', ['core', 'scheduling']),
      inRepoModule('scheduling', ['core', 'planning']),
    ]);

    expect(error.problems).toEqual(['Module dependency cycle: planning -> scheduling -> planning']);
  });

  it('E02-S01 a cycle names only its own modules, in cycle order, starting from the smallest id', () => {
    // The walk reaches the cycle from assembly and enters it at scheduling.
    const error = refusal([
      core,
      inRepoModule('assembly', ['core', 'scheduling']),
      inRepoModule('scheduling', ['quality']),
      inRepoModule('quality', ['planning']),
      inRepoModule('planning', ['scheduling']),
    ]);

    expect(error.problems).toEqual([
      'Module dependency cycle: planning -> scheduling -> quality -> planning',
    ]);
  });

  it('E02-S01 modules come back core first, in dependency order, plugins last', () => {
    const catalog = checkCatalog(
      [
        plugin('acme-audit', ['acme-validator']),
        inRepoModule('planning', ['core']),
        plugin('acme-validator', ['planning']),
        inRepoModule('assembly', ['core', 'quality']),
        inRepoModule('quality', ['core']),
        core,
      ],
      { imageVersion },
    );

    expect(catalog.map((entry) => entry.manifest.id)).toEqual([
      'core',
      'quality',
      'assembly',
      'planning',
      'acme-validator',
      'acme-audit',
    ]);
  });
});
