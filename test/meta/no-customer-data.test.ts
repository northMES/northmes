import { createHash } from 'node:crypto';
import { matchesGlob } from 'node:path';
import { describe, expect, it } from 'vitest';
import { scan } from '../../scripts/lint/no-customer-data.mjs';
import vitestConfig from '../../vitest.config.ts';

interface VitestConfig {
  test?: { projects?: unknown[] };
}

interface InlineProject {
  test?: { name?: string; exclude?: string[] };
}

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
});
