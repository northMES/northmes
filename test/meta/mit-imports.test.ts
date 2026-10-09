// SPDX-License-Identifier: AGPL-3.0-or-later
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { scan, trackedWorkspace } from '../../scripts/lint/mit-imports.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));

type Finding =
  | { kind: 'import'; path: string; line: number; imported: string }
  | { kind: 'license'; path: string; license: string | undefined };

// A finding as a failing test prints it: the file and the package it imports, or the manifest and
// its license.
function describeFinding(finding: Finding): string {
  return finding.kind === 'import'
    ? `${finding.path}:${finding.line} imports ${finding.imported}`
    : `${finding.path} has license ${finding.license ?? '(none)'}, not MIT`;
}

const workspacePackages = [
  {
    path: 'apps/backend/package.json',
    manifest: { name: '@northmes/backend', license: 'AGPL-3.0-or-later' },
  },
  {
    path: 'apps/web/package.json',
    manifest: { name: '@northmes/web', license: 'AGPL-3.0-or-later' },
  },
  {
    path: 'modules/planning/domain/package.json',
    manifest: { name: '@northmes/planning-domain', license: 'AGPL-3.0-or-later' },
  },
  {
    path: 'modules/planning/contracts/package.json',
    manifest: { name: '@northmes/planning-contracts', license: 'MIT' },
  },
  {
    path: 'packages/contracts/package.json',
    manifest: { name: '@northmes/contracts', license: 'MIT' },
  },
  { path: 'packages/sdk/package.json', manifest: { name: '@northmes/sdk', license: 'MIT' } },
];

describe('mit-imports', () => {
  it('E02-S01 an MIT package that imports an AGPL package fails naming the file and the package', () => {
    const findings = scan(workspacePackages, [
      {
        path: 'packages/sdk/src/index.ts',
        text: [
          "import { z } from 'zod';",
          "import { defineCommandContract } from '@northmes/contracts';",
          "import { schedule } from '@northmes/planning-domain';",
          '',
        ].join('\n'),
      },
      {
        path: 'modules/planning/contracts/src/index.ts',
        text: "export { planningLinks } from './links.ts';\n",
      },
      {
        path: 'apps/backend/src/modules/planning/planning.module.ts',
        text: "import { schedule } from '@northmes/planning-domain';\n",
      },
    ]);

    expect(findings).toEqual([
      {
        kind: 'import',
        path: 'packages/sdk/src/index.ts',
        line: 3,
        imported: '@northmes/planning-domain',
      },
    ]);
  });

  it('E02-S01 a test file of an MIT package that imports an AGPL package fails', () => {
    const findings = scan(workspacePackages, [
      {
        path: 'packages/sdk/test/host.int.test.ts',
        text: [
          "import { createHostApp } from '@northmes/backend/testing';",
          "const { shellModules } = await import('@northmes/web');",
          "import { boot } from '../../../apps/backend/src/boot/boot.ts';",
          "import { contract } from '../../contracts/src/index.ts';",
          "const main = new URL('../../../apps/backend/dist/main.js', import.meta.url);",
          '',
        ].join('\n'),
      },
    ]);

    expect(findings).toEqual([
      {
        kind: 'import',
        path: 'packages/sdk/test/host.int.test.ts',
        line: 1,
        imported: '@northmes/backend',
      },
      {
        kind: 'import',
        path: 'packages/sdk/test/host.int.test.ts',
        line: 2,
        imported: '@northmes/web',
      },
      {
        kind: 'import',
        path: 'packages/sdk/test/host.int.test.ts',
        line: 3,
        imported: '@northmes/backend',
      },
    ]);
  });

  it('E02-S01 an MIT file that imports code of the AGPL root package fails', () => {
    const root = {
      path: 'package.json',
      manifest: { name: 'northmes', license: 'AGPL-3.0-or-later' },
    };

    const findings = scan(
      [root, ...workspacePackages],
      [
        {
          path: 'packages/sdk/src/x.ts',
          text: [
            "import { render } from '../../../scripts/x.mjs';",
            "import northmes from 'northmes';",
            "import { contract } from '../../contracts/src/index.ts';",
            "import { boot } from '../../../apps/backend/src/boot/boot.ts';",
            '',
          ].join('\n'),
        },
      ],
    );

    expect(findings).toEqual([
      { kind: 'import', path: 'packages/sdk/src/x.ts', line: 1, imported: 'northmes' },
      { kind: 'import', path: 'packages/sdk/src/x.ts', line: 2, imported: 'northmes' },
      { kind: 'import', path: 'packages/sdk/src/x.ts', line: 4, imported: '@northmes/backend' },
    ]);
  });

  it('E02-S01 an examples plugin that imports an AGPL package fails', () => {
    const plugin = {
      path: 'examples/plugin-validator/package.json',
      manifest: { name: '@northmes/example-validator', license: 'AGPL-3.0-or-later' },
    };

    const findings = scan(
      [...workspacePackages, plugin],
      [
        {
          path: 'examples/plugin-validator/src/manifest.ts',
          text: [
            "import { defineModule } from '@northmes/sdk';",
            "import { planningContracts } from '@northmes/planning-contracts';",
            "import { validator } from './validator.ts';",
            "export type { Manifest } from '@northmes/example-validator/manifest';",
            '',
          ].join('\n'),
        },
        {
          path: 'examples/plugin-validator/test/validator.test.ts',
          text: "import { schedule } from '@northmes/planning-domain';\n",
        },
      ],
    );

    expect(findings).toEqual([
      {
        kind: 'import',
        path: 'examples/plugin-validator/test/validator.test.ts',
        line: 1,
        imported: '@northmes/planning-domain',
      },
    ]);
  });

  it('E02-S01 a contracts package that is not MIT fails', () => {
    const findings = scan(
      [
        ...workspacePackages,
        {
          path: 'modules/quality/contracts/package.json',
          manifest: { name: '@northmes/quality-contracts', license: 'AGPL-3.0-or-later' },
        },
        {
          path: 'modules/stock/contracts/package.json',
          manifest: { name: '@northmes/stock-contracts' },
        },
      ],
      [],
    );

    expect(findings).toEqual([
      {
        kind: 'license',
        path: 'modules/quality/contracts/package.json',
        license: 'AGPL-3.0-or-later',
      },
      { kind: 'license', path: 'modules/stock/contracts/package.json', license: undefined },
    ]);
  });

  it('E02-S01 the repository passes', () => {
    const { packages, files } = trackedWorkspace(root);

    expect(packages.map(({ path }) => path)).toEqual(
      expect.arrayContaining([
        'package.json',
        'apps/backend/package.json',
        'examples/plugin-validator/package.json',
        'modules/planning/contracts/package.json',
        'packages/sdk/package.json',
      ]),
    );
    expect(packages.filter(({ path }) => path.startsWith('docs/'))).toEqual([]);
    expect(files.map(({ path }) => path)).toContain('packages/sdk/src/index.ts');
    expect(scan(packages, files).map(describeFinding)).toEqual([]);
  });
});
