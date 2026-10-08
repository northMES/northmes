// SPDX-License-Identifier: AGPL-3.0-or-later
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { BootError } from '../src/boot/boot-error.ts';
import {
  type CatalogEntry,
  type CatalogOptions,
  checkCatalog,
} from '../src/catalog/check-catalog.ts';
import { core, imageVersion, inRepoModule, plugin } from './fixtures/catalog.ts';

// The BootError that checkCatalog throws for a catalog it refuses.
function refusal(
  entries: readonly CatalogEntry[],
  options: CatalogOptions = { imageVersion },
): BootError {
  try {
    checkCatalog(entries, options);
  } catch (error) {
    if (error instanceof BootError) return error;
    throw error;
  }
  throw new Error('checkCatalog accepted the catalog');
}

// Runs in a fresh Node process: checks each catalog given as JSON on the command line and prints
// its boot order or its problems, with the locale that Intl collates in by default.
const checkCatalogs = `
const [url, catalogs, imageVersion] = process.argv.slice(1);
const { checkCatalog } = await import(url);
const outcomes = JSON.parse(catalogs).map((entries) => {
  try {
    return { order: checkCatalog(entries, { imageVersion }).map((entry) => entry.manifest.id) };
  } catch (error) {
    return { problems: error.problems };
  }
});
const locale = new Intl.Collator().resolvedOptions().locale;
process.stdout.write(JSON.stringify({ locale, outcomes }));
`;

interface LocaleRun {
  locale: string;
  outcomes: ({ order: string[] } | { problems: string[] })[];
}

// Checks the catalogs in a Node process whose default locale is Czech, where "ch" sorts after "h".
// Node takes its default locale from the environment when it starts, so this needs a new process.
function checkInCzechLocale(catalogs: readonly (readonly CatalogEntry[])[]): LocaleRun {
  const url = new URL('../src/catalog/check-catalog.ts', import.meta.url).href;
  const child = spawnSync(
    process.execPath,
    [
      '--conditions=@northmes/source',
      '--input-type=module',
      '--eval',
      checkCatalogs,
      url,
      JSON.stringify(catalogs),
      imageVersion,
    ],
    { env: { ...process.env, LANG: 'cs_CZ.UTF-8', LC_ALL: 'cs_CZ.UTF-8' }, encoding: 'utf8' },
  );

  expect(child.status, child.stderr).toBe(0);
  return JSON.parse(child.stdout) as LocaleRun;
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

  it('E02-S01 three problems are listed as 3 problems', () => {
    const error = refusal([
      core,
      inRepoModule('planning', ['core', 'quality']),
      inRepoModule('scheduling', ['core', 'overtime-validator']),
      plugin('overtime-validator', ['shift-calendar']),
      plugin('shift-calendar', ['overtime-validator']),
    ]);

    expect(error.message).toBe(
      [
        'refused to start (3 problems)',
        '- Module planning depends on "quality", which is not installed',
        '- Core module scheduling must not depend on plugin overtime-validator',
        '- Module dependency cycle: overtime-validator -> shift-calendar -> overtime-validator',
      ].join('\n'),
    );
  });

  it('E02-S01 one problem is listed as 1 problem', () => {
    const error = refusal([core, inRepoModule('planning', ['core', 'quality'])]);

    expect(error.message).toMatch(/^refused to start \(1 problem\)\n/);
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

  it('E02-S01 module ids web, station and auth are each refused as reserved, and the message names the id', () => {
    const error = refusal([
      core,
      inRepoModule('web', ['core']),
      plugin('station', ['core']),
      inRepoModule('auth', ['core']),
    ]);

    expect(error.problems).toEqual([
      'Module id "web" is reserved: /api/v1/web is a first-party path segment',
      'Module id "station" is reserved: /api/v1/station is a first-party path segment',
      'Module id "auth" is reserved: /api/v1/auth is a library path segment',
    ]);
  });

  it('E02-S01 two modules whose derived names collide are refused naming both ids', () => {
    // Both ids derive the GraphQL and remote name press2.
    const error = refusal([core, inRepoModule('press-2', ['core']), plugin('press2', ['core'])]);

    expect(error.problems).toEqual([
      'Modules press-2 and press2 derive the same name press2; give one of them another id',
    ]);
  });

  it('E02-S01 image 0.4.0-rc.1 satisfies range >=0.3.0 <0.5.0', () => {
    const range = { northmes: '>=0.3.0 <0.5.0' };
    const catalog = checkCatalog(
      [inRepoModule('core', [], range), inRepoModule('planning', ['core'], range)],
      { imageVersion: '0.4.0-rc.1' },
    );

    expect(catalog.map((entry) => entry.manifest.id)).toEqual(['core', 'planning']);
  });

  it('E02-S01 image 0.5.0 outside range >=0.3.0 <0.5.0 is refused naming both versions', () => {
    const error = refusal(
      [inRepoModule('planning', [], { northmes: '>=0.3.0 <0.5.0' }), plugin('acme-audit')],
      { imageVersion: '0.5.0' },
    );

    expect(error.problems).toEqual([
      'Module planning 0.0.0 runs on NorthMES >=0.3.0 <0.5.0, and this image is 0.5.0',
      'Module acme-audit 0.0.0 runs on NorthMES >=0.0.0-0 <0.1.0-0, and this image is 0.5.0',
    ]);
  });

  it("E02-S01 a command key without its module's GraphQL prefix is refused naming the key", () => {
    // production-start derives the GraphQL name productionStart and the SQL name production_start.
    const error = refusal([
      core,
      inRepoModule('production-start', ['core'], {
        commands: { 'productionStart.reportQuantity': {}, 'production_start.startJob': {} },
      }),
    ]);

    expect(error.problems).toEqual([
      'Module production-start declares command "production_start.startJob", which must start with "productionStart."',
    ]);
  });

  it('E02-S01 ids sort by character code, so a Czech locale gives the same order and cycle', () => {
    const { locale, outcomes } = checkInCzechLocale([
      [
        inRepoModule('heat-treatment', ['core']),
        inRepoModule('cleaning', ['core']),
        inRepoModule('changeover', ['core']),
        core,
      ],
      [core, inRepoModule('cleaning', ['changeover']), inRepoModule('changeover', ['cleaning'])],
    ]);

    expect(locale).toBe('cs-CZ');
    expect(outcomes).toEqual([
      { order: ['core', 'changeover', 'cleaning', 'heat-treatment'] },
      { problems: ['Module dependency cycle: changeover -> cleaning -> changeover'] },
    ]);
  });
});
