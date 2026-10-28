// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  annotate,
  defaultPolicy,
  evaluate,
  licenseClasses,
  neverInstalled,
  osiApproved,
  review,
  scanPackage,
} from './license-gate.mjs';

// The fixture SBOMs have the shape that `pnpm sbom --sbom-format cyclonedx --split` writes, one
// workspace package per file. Their package names are synthetic, except where a test is about a
// named package.
const fixtures = fileURLToPath(new URL('./fixtures/license-gate/', import.meta.url));
const script = fileURLToPath(new URL('./license-gate.mjs', import.meta.url));
const root = fileURLToPath(new URL('../', import.meta.url));

interface Bom {
  metadata: { component: { name: string; group?: string } };
  components: { name: string; version: string; group?: string }[];
}

interface Finding {
  package: string;
  component: string;
  class: string;
  license: string;
  rule: string;
  message: string;
}

interface Policy {
  clarifications: { package: string; license: string; reason: string }[];
  exceptions: { package: string; class: string; license: string; reason: string }[];
  workspace: string[];
}

function fixture(name: string): Bom {
  return JSON.parse(readFileSync(join(fixtures, name), 'utf8')) as Bom;
}

function policy(overrides: Partial<Policy> = {}): Policy {
  return { ...(defaultPolicy as Policy), ...overrides };
}

function components(findings: Finding[]): string[] {
  return findings.map(({ component }) => component).sort();
}

describe('license gate', () => {
  it('ADR0040 a GPL-3.0 package fails naming the package', () => {
    const violations = evaluate(fixture('gpl.cdx.json'), policy()) as Finding[];

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      package: '@northmes/backend',
      component: 'copyleft-kit@3.0.0',
      class: 'core',
      license: 'GPL-3.0-only',
    });
    expect(violations[0]?.message).toContain('copyleft-kit@3.0.0');
  });

  it('ADR0040 a package with an ee/ folder fails', () => {
    const sbom = annotate(fixture('enterprise.cdx.json'), ({ name }: { name: string }) =>
      join(fixtures, 'packages', name),
    );
    const violations = evaluate(sbom, policy()) as Finding[];

    expect(components(violations)).toEqual(['agent-kit@0.5.0', 'dash-kit@1.0.0']);
    expect(violations.every(({ rule }) => rule === 'enterprise')).toBe(true);
    expect(violations.find(({ component }) => component === 'agent-kit@0.5.0')?.message).toContain(
      'ee/',
    );
    expect(violations.find(({ component }) => component === 'dash-kit@1.0.0')?.message).toContain(
      'LICENSE',
    );
  });

  it('ADR0040 the scan finds ee/ folders and Enterprise license files, and not the word enterprise in other text', () => {
    expect(scanPackage(join(fixtures, 'packages', 'agent-kit'))).toEqual(['ee/']);
    expect(scanPackage(join(fixtures, 'packages', 'dash-kit'))).toEqual(['LICENSE']);
    expect(scanPackage(join(fixtures, 'packages', 'plain-kit'))).toEqual([]);
  });

  it('ADR0040 a package on the never-install list fails', () => {
    const violations = evaluate(fixture('never-installed.cdx.json'), policy()) as Finding[];
    const named = violations.filter(({ rule }) => rule === 'never-installed');

    expect(components(named)).toEqual([
      '@apollo/gateway@2.10.0',
      '@base-ui-components/react@1.0.0',
      '@better-auth/cli@1.4.0',
      '@graphql-yoga/nestjs-federation@3.0.0',
      '@mastra/core@0.10.0',
      '@sentry/node@11.0.0',
      'exceljs@4.4.0',
      'xlsx@0.18.5',
    ]);
  });

  it('ADR0040 the never-install list holds for the dev tree too, except @sentry/node, which only the server may not take', () => {
    const violations = evaluate(fixture('never-installed-dev.cdx.json'), policy()) as Finding[];

    expect(components(violations)).toEqual(['exceljs@4.4.0']);
    expect(violations[0]?.rule).toBe('never-installed');
  });

  it('ADR0040 an MIT and Apache-2.0 tree passes', () => {
    const result = review(fixture('permissive.cdx.json'), policy()) as {
      violations: Finding[];
      notes: Finding[];
    };

    expect(result.violations).toEqual([]);
    expect(result.notes).toEqual([]);
  });

  it('ADR0040 an Elastic-2.0 component under a core package fails naming it', () => {
    const violations = evaluate(fixture('elastic.cdx.json'), policy()) as Finding[];

    expect(violations).toEqual([
      expect.objectContaining({
        package: '@northmes/backend',
        component: 'gateway-kit@1.2.0',
        class: 'core',
        license: 'Elastic-2.0',
        rule: 'license',
      }),
    ]);
    expect(violations[0]?.message).toContain('gateway-kit@1.2.0');
  });

  it('ADR0040 SEE LICENSE IN LICENSE fails until license-clarifications.json maps that exact version', () => {
    const sbom = fixture('see-license.cdx.json');
    const clarified = (pkg: string) => [
      { package: pkg, license: 'MIT', reason: 'Synthetic: the license file holds the MIT text.' },
    ];

    expect(components(evaluate(sbom, policy()) as Finding[])).toEqual(['vendor-tool@3.1.0']);
    expect(
      components(evaluate(sbom, policy({ clarifications: clarified('vendor-tool@3.0.0') }))),
    ).toEqual(['vendor-tool@3.1.0']);
    expect(
      components(evaluate(sbom, policy({ clarifications: clarified('vendor-tool') }))),
    ).toEqual(['vendor-tool@3.1.0']);
    expect(evaluate(sbom, policy({ clarifications: clarified('vendor-tool@3.1.0') }))).toEqual([]);
  });

  it('ADR0040 a clarification maps to an SPDX expression that the class still judges', () => {
    const sbom = fixture('see-license.cdx.json');
    const clarifications = [
      { package: 'vendor-tool@3.1.0', license: 'BUSL-1.1', reason: 'Synthetic.' },
    ];

    expect(components(evaluate(sbom, policy({ clarifications })) as Finding[])).toEqual([
      'vendor-tool@3.1.0',
    ]);
  });

  it('ADR0040 MPL-2.0 fails under an MIT package and passes with a note under core', () => {
    const underMit = review(fixture('mpl-mit.cdx.json'), policy()) as { violations: Finding[] };
    const underCore = review(fixture('mpl-core.cdx.json'), policy()) as {
      violations: Finding[];
      notes: Finding[];
    };

    expect(underMit.violations).toEqual([
      expect.objectContaining({ package: '@northmes/sdk', component: 'css-engine@1.0.0' }),
    ]);
    expect(underMit.violations[0]?.class).toBe('mit');
    expect(underCore.violations).toEqual([]);
    expect(underCore.notes).toEqual([
      expect.objectContaining({
        package: '@northmes/web',
        component: 'css-engine@1.0.0',
        license: 'MPL-2.0',
      }),
    ]);
  });

  it('ADR0040 (MIT OR GPL-3.0-or-later) and MIT AND Zlib pass under core', () => {
    const result = review(fixture('expressions.cdx.json'), policy()) as {
      violations: Finding[];
      notes: Finding[];
    };

    expect(result.violations).toEqual([]);
    expect(result.notes).toEqual([]);
  });

  it('ADR0040 an AND fails when one part is denied, and an OR fails when every branch is denied', () => {
    const violations = evaluate(fixture('expressions-denied.cdx.json'), policy()) as Finding[];

    expect(components(violations)).toEqual(['choice-kit@1.0.0', 'mixed-kit@1.0.0']);
  });

  it('ADR0040 a package without a license fails', () => {
    const violations = evaluate(fixture('no-license.cdx.json'), policy()) as Finding[];

    expect(violations).toEqual([
      expect.objectContaining({ component: 'bare-kit@0.0.1', rule: 'license', license: '' }),
    ]);
  });

  it('ADR0040 an MIT package fails on a workspace dependency on an AGPL package', () => {
    const violations = evaluate(
      fixture('mit-agpl.cdx.json'),
      policy({ workspace: ['@northmes/contracts', '@northmes/planning-domain'] }),
    ) as Finding[];

    expect(violations).toEqual([
      expect.objectContaining({
        package: '@northmes/sdk',
        component: '@northmes/planning-domain@0.1.0',
        rule: 'workspace',
      }),
    ]);
  });

  it('ADR0040 a workspace package whose license selects no class fails', () => {
    const violations = evaluate(fixture('unknown-class.cdx.json'), policy()) as Finding[];

    expect(violations).toEqual([
      expect.objectContaining({ package: '@northmes/tool', rule: 'class', license: 'Apache-2.0' }),
    ]);
  });

  it('ADR0040 the dev class allows OSI-approved licenses and a reviewed exception for that exact version and license', () => {
    const sbom = fixture('dev.cdx.json');
    const exceptions = [
      {
        package: 'react-doctor@0.9.14',
        class: 'dev',
        license: 'SEE LICENSE IN LICENSE',
        reason: 'Synthetic.',
      },
      { package: 'caniuse-lite', class: 'dev', license: 'CC-BY-4.0', reason: 'Synthetic.' },
    ];
    const wrongClass = exceptions.map((exception) => ({ ...exception, class: 'core' }));

    expect(components(evaluate(sbom, policy()) as Finding[])).toEqual([
      'caniuse-lite@1.0.30001812',
      'react-doctor@0.9.14',
    ]);
    expect(components(evaluate(sbom, policy({ exceptions: wrongClass })) as Finding[])).toEqual([
      'caniuse-lite@1.0.30001812',
      'react-doctor@0.9.14',
    ]);
    const passed = review(sbom, policy({ exceptions })) as {
      violations: Finding[];
      notes: Finding[];
    };
    expect(passed.violations).toEqual([]);
    expect(components(passed.notes)).toEqual(['caniuse-lite@1.0.30001812', 'react-doctor@0.9.14']);
  });

  it('ADR0040 the policy table matches docs/adr/0040-dependency-license-policy-ci-gate-and-sbom.md', () => {
    const adr = readFileSync(
      join(root, 'docs/adr/0040-dependency-license-policy-ci-gate-and-sbom.md'),
      'utf8',
    );
    const row = (label: string) =>
      (adr.split('\n').find((line) => line.startsWith(`| ${label} |`)) ?? '')
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim());
    const ids = (cell: string | undefined) =>
      cell === 'none' ? [] : (cell ?? '').split(/[,;] /).map((part) => part.split(' ')[0]);
    const [, , coreAllowed, coreNoted] = row('Core');
    const [, , mitAllowed, mitNoted] = row('MIT packages');
    const [, , devAllowed] = row('Dev only');

    expect(licenseClasses.core.selectedBy).toBe('AGPL-3.0-or-later');
    expect(licenseClasses.core.allowed).toEqual(ids(coreAllowed));
    expect(Object.keys(licenseClasses.core.noted)).toEqual(ids(coreNoted));
    expect(licenseClasses.mit.selectedBy).toBe('MIT');
    expect(licenseClasses.mit.allowed).toEqual(ids(mitAllowed));
    expect(Object.keys(licenseClasses.mit.noted)).toEqual(ids(mitNoted));
    expect(devAllowed).toBe('any OSI-approved license');
    expect(licenseClasses.dev.allowed).toEqual(osiApproved);
  });

  it('ADR0040 no class allows a license that the ADR denies in core, and the dev class allows no source-available license', () => {
    const denied = /^(?:GPL|AGPL|LGPL|Elastic|SSPL|BUSL|FSL|RSAL|PolyForm|Commons-Clause)/;

    for (const id of [...licenseClasses.core.allowed, ...licenseClasses.mit.allowed]) {
      expect(id).not.toMatch(denied);
    }
    for (const id of osiApproved as string[]) {
      expect(id).not.toMatch(/^(?:Elastic|SSPL|BUSL|FSL|RSAL|PolyForm|Commons-Clause|CC-BY)/);
    }
  });

  it('ADR0040 the never-install list holds every npm package of the ADR table', () => {
    const adr = readFileSync(
      join(root, 'docs/adr/0040-dependency-license-policy-ci-gate-and-sbom.md'),
      'utf8',
    );
    const table = adr.split('### Never installed')[1]?.split('\n\n')[1] ?? '';
    const packages = table
      .split('\n')
      .slice(2)
      .flatMap((line) => [...(line.split('|')[1] ?? '').matchAll(/`([^`]+)`/g)].map(([, n]) => n));
    const names = (neverInstalled as { name: string }[]).map(({ name }) => name);

    expect(packages, 'npm packages in the Never installed table').not.toHaveLength(0);
    expect(names).toEqual(expect.arrayContaining([...packages, 'mastra', '@mastra/*']));
    expect(neverInstalled).toContainEqual(
      expect.objectContaining({ name: '@sentry/node', in: '@northmes/backend' }),
    );
  });

  it('ADR0040 license-clarifications.json and license-exceptions.json give a reason for each entry, and react-doctor is excepted for 0.9.14 in the dev class only', () => {
    const { clarifications } = JSON.parse(
      readFileSync(join(root, 'license-clarifications.json'), 'utf8'),
    ) as Policy;
    const { exceptions } = JSON.parse(
      readFileSync(join(root, 'license-exceptions.json'), 'utf8'),
    ) as Policy;

    for (const entry of [...clarifications, ...exceptions]) {
      expect(entry.reason.length, entry.package).toBeGreaterThan(40);
    }
    for (const { package: pkg } of clarifications) {
      expect(pkg, 'a clarification names an exact version').toMatch(/^(?:@[^/]+\/)?[^@]+@\d/);
    }
    const reactDoctor = exceptions.filter(({ package: pkg }) => /react-doctor/.test(pkg));
    expect(reactDoctor).toEqual([
      expect.objectContaining({
        package: 'react-doctor@0.9.14',
        class: 'dev',
        license: 'SEE LICENSE IN LICENSE',
      }),
      expect.objectContaining({
        package: 'oxlint-plugin-react-doctor@0.9.14',
        class: 'dev',
        license: 'SEE LICENSE IN LICENSE',
      }),
    ]);
    expect(exceptions).toContainEqual(
      expect.objectContaining({ package: 'caniuse-lite', class: 'dev', license: 'CC-BY-4.0' }),
    );
  });
});

describe('scripts/license-gate.mjs', () => {
  let dir: string;
  let summary: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'northmes-license-gate-'));
    summary = join(dir, 'summary.md');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function gate(...args: string[]) {
    return spawnSync(
      process.execPath,
      [script, '--modules', join(dir, 'no-modules'), '--summary', summary, ...args],
      { cwd: root, encoding: 'utf8' },
    );
  }

  function copy(name: string, to: string) {
    mkdirSync(join(dir, to), { recursive: true });
    cpSync(join(fixtures, name), join(dir, to, name));
    return join(dir, to);
  }

  it('ADR0040 judges a component that only the full tree has under the dev class, and writes a Markdown summary', () => {
    const result = gate('--prod', join(fixtures, 'prod'), '--all', join(fixtures, 'all'));

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    const markdown = readFileSync(summary, 'utf8');
    expect(markdown).toMatch(/^## License gate\n/);
    expect(markdown).toContain('No violations');
  });

  it('ADR0040 exits non-zero on a violation and names it in the summary', () => {
    copy('elastic.cdx.json', 'prod');

    const result = gate('--prod', join(dir, 'prod'));

    expect(result.status).toBe(1);
    const markdown = readFileSync(summary, 'utf8');
    expect(markdown).toContain('gateway-kit@1.2.0');
    expect(markdown).toContain('Elastic-2.0');
    expect(result.stdout).toContain('gateway-kit@1.2.0');
  });

  it('ADR0040 without --all every component is judged under the class of its package', () => {
    const result = gate('--prod', join(fixtures, 'all'));

    expect(result.status).toBe(1);
    expect(readFileSync(summary, 'utf8')).toContain('test-kit@5.0.0');
  });

  it('ADR0040 fails when no SBOM is found, so an empty folder never passes', () => {
    mkdirSync(join(dir, 'empty'));

    const result = gate('--prod', join(dir, 'empty'));

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('no SBOM');
  });
});
