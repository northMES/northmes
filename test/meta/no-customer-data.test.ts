import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, matchesGlob } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { scan } from '../../scripts/lint/no-customer-data.mjs';
import vitestConfig from '../../vitest.config.ts';

interface VitestConfig {
  test?: { projects?: unknown[] };
}

interface InlineProject {
  test?: { name?: string; exclude?: string[] };
}

const root = fileURLToPath(new URL('../../', import.meta.url));
const script = fileURLToPath(new URL('../../scripts/lint/no-customer-data.mjs', import.meta.url));

// Built at run time, so this file never holds the pattern it tests. The check digit is wrong, so
// the number belongs to no organisation.
const organisationNumber = ['123', '456', '-', '78', '90'].join('');

// An invented name. A deny-list entry is the SHA-256 of the name's words, lowercased and joined by
// one space.
const customerName = 'Acme Verkstad AB';
const customerNameHash = createHash('sha256').update('acme verkstad ab').digest('hex');

describe('no-customer-data', () => {
  it('an in-memory file with a 6-4 digit organisation number fails', () => {
    const result = scan(
      [
        { path: 'README.md', content: 'Nothing to report.\n' },
        {
          path: 'modules/orders/src/customer.ts',
          content: `const a = 1;\nconst org = '${organisationNumber}';\n`,
        },
      ],
      [],
    );

    expect(result.findings).toEqual([
      { path: 'modules/orders/src/customer.ts', line: 2, kind: 'organisation-number' },
    ]);
  });

  it('an in-memory file holding a deny-listed name fails', () => {
    const result = scan(
      [
        {
          path: 'docs/sources/spike/orders.ts',
          content: `// Orders\nconst customer = '${customerName}';\n`,
        },
        { path: 'fixtures/customers.csv', content: 'id,name\n7,"ACME  verkstad, ab"\n' },
        {
          path: 'modules/erp/test/fixtures/customer.json',
          content: '{ "name": "acme-verkstad ab" }',
        },
        { path: 'docs/sources/spike/README.md', content: 'Orders from\nAcme\nVerkstad AB.\n' },
        { path: 'docs/sources/spike/near.ts', content: 'Acme Verkstad\nAcme Verkstad ABC\n' },
        { path: 'docs/plan/notes.md', content: `${customerName}\n` },
      ],
      [customerNameHash],
    );

    expect(result.findings).toEqual([
      { path: 'docs/sources/spike/orders.ts', line: 2, kind: 'customer-name' },
      { path: 'fixtures/customers.csv', line: 2, kind: 'customer-name' },
      { path: 'modules/erp/test/fixtures/customer.json', line: 1, kind: 'customer-name' },
      { path: 'docs/sources/spike/README.md', line: 2, kind: 'customer-name' },
    ]);
  });

  it('without deny hashes the name check is skipped and the number check runs', () => {
    const files = [
      { path: 'docs/sources/spike/orders.ts', content: `const customer = '${customerName}';\n` },
      { path: 'fixtures/orders.json', content: `{ "org": "${organisationNumber}" }\n` },
    ];

    for (const denyHashes of [undefined, []]) {
      const result = scan(files, denyHashes);

      expect(result.notice).toContain('customer name check was skipped');
      expect(result.findings).toEqual([
        { path: 'fixtures/orders.json', line: 1, kind: 'organisation-number' },
      ]);
    }
    expect(scan(files, [customerNameHash]).notice).toBeUndefined();
  });

  it('docs/sources is excluded from every Vitest project', () => {
    const projects = (vitestConfig as VitestConfig).test?.projects ?? [];
    expect(projects).not.toHaveLength(0);

    for (const project of projects) {
      expect(typeof project, 'projects are inline, so this test can read their excludes').toBe(
        'object',
      );
      const { name, exclude = [] } = (project as InlineProject).test ?? {};
      for (const path of [
        'docs/sources/spike-integration/apps/server/test/boot.test.ts',
        'docs/sources/earlier-attempt/placement.spec.ts',
      ]) {
        expect(
          exclude.some((pattern) => matchesGlob(path, pattern)),
          `${name}: ${path}`,
        ).toBe(true);
      }
    }
  });

  describe('the entry point', () => {
    let repository: string;

    // The lint and git in these tests see neither the caller's deny hashes nor a GIT_DIR from a hook.
    function environment(extra: Record<string, string> = {}): Record<string, string> {
      const inherited = Object.entries(process.env).filter(
        (entry): entry is [string, string] =>
          entry[1] !== undefined &&
          !entry[0].startsWith('GIT_') &&
          entry[0] !== 'NORTHMES_DENY_HASHES',
      );
      return { ...Object.fromEntries(inherited), ...extra };
    }

    function git(...args: string[]) {
      const result = spawnSync('git', args, {
        cwd: repository,
        encoding: 'utf8',
        env: environment(),
      });
      expect(result.status, result.stderr).toBe(0);
    }

    function write(path: string, content: string) {
      mkdirSync(dirname(join(repository, path)), { recursive: true });
      writeFileSync(join(repository, path), content);
    }

    function lint(cwd: string, env: Record<string, string> = {}) {
      return spawnSync(process.execPath, [script], {
        cwd,
        encoding: 'utf8',
        env: environment(env),
      });
    }

    beforeAll(() => {
      repository = mkdtempSync(join(tmpdir(), 'no-customer-data-'));
      git('init', '-q');
      write('src/orders.ts', `const a = 1;\nconst org = '${organisationNumber}';\n`);
      write('docs/sources/spike/README.md', `Orders from ${customerName}.\n`);
      write('assets/logo.bin', `\u0000${organisationNumber}`);
      git('add', '.');
      write('notes/untracked.md', `${organisationNumber}\n`);
    });

    afterAll(() => {
      rmSync(repository, { recursive: true, force: true });
    });

    it('fails on a tracked text file and names only its path and line', () => {
      for (const cwd of [repository, join(repository, 'src')]) {
        const result = lint(cwd);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('src/orders.ts:2: organisation number pattern');
        expect(result.stderr).not.toMatch(/README|logo|untracked/);
        expect(`${result.stdout}${result.stderr}`).not.toContain(organisationNumber);
        expect(result.stdout).toContain('customer name check was skipped');
      }
    });

    it('reads the deny hashes from NORTHMES_DENY_HASHES', () => {
      const result = lint(repository, {
        NORTHMES_DENY_HASHES: `${'0'.repeat(64)},${customerNameHash.toUpperCase()}`,
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('src/orders.ts:2: organisation number pattern');
      expect(result.stderr).toContain('docs/sources/spike/README.md:1: deny-listed customer name');
      expect(`${result.stdout}${result.stderr}`).not.toContain(customerName);
      expect(result.stdout).not.toContain('skipped');
    });

    it('rejects a NORTHMES_DENY_HASHES entry that is not a SHA-256 digest', () => {
      const result = lint(repository, {
        NORTHMES_DENY_HASHES: `${customerNameHash},${customerName}`,
      });

      expect(result.status).toBe(2);
      expect(result.stderr).toContain('NORTHMES_DENY_HASHES');
      expect(`${result.stdout}${result.stderr}`).not.toMatch(/acme/i);
    });

    it('runs as the root script lint:customer-data', () => {
      const scripts = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts;

      expect(scripts['lint:customer-data']).toBe('node scripts/lint/no-customer-data.mjs');
    });

    it('passes on this repository: no tracked file holds a 6-4 digit organisation number', () => {
      const result = lint(root);

      expect(result.stderr).toBe('');
      expect(result.status).toBe(0);
    });
  });
});
