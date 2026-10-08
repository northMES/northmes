// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { scan } from '../../scripts/lint/mit-imports.mjs';

const workspacePackages = [
  {
    path: 'apps/server/package.json',
    manifest: { name: '@northmes/server', license: 'AGPL-3.0-or-later' },
  },
  {
    path: 'modules/core/package.json',
    manifest: { name: '@northmes/module-core', license: 'AGPL-3.0-or-later' },
  },
  {
    path: 'modules/planning/package.json',
    manifest: { name: '@northmes/module-planning', license: 'AGPL-3.0-or-later' },
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
          "import { coreModule } from '@northmes/module-core';",
          '',
        ].join('\n'),
      },
      {
        path: 'modules/planning/contracts/src/index.ts',
        text: "export { planningLinks } from './links.ts';\n",
      },
      {
        path: 'modules/planning/server/planning.module.ts',
        text: "import { coreModule } from '@northmes/module-core';\n",
      },
    ]);

    expect(findings).toEqual([
      {
        kind: 'import',
        path: 'packages/sdk/src/index.ts',
        line: 3,
        imported: '@northmes/module-core',
      },
    ]);
  });

  it('E02-S01 a test file of an MIT package that imports an AGPL package fails', () => {
    const findings = scan(workspacePackages, [
      {
        path: 'packages/sdk/test/host.int.test.ts',
        text: [
          "import { createHostApp } from '@northmes/server/testing';",
          "const { loadCatalog } = await import('@northmes/module-planning');",
          "import { boot } from '../../../apps/server/src/boot/boot.ts';",
          "import { contract } from '../../contracts/src/index.ts';",
          "const main = new URL('../../../apps/server/dist/main.js', import.meta.url);",
          '',
        ].join('\n'),
      },
    ]);

    expect(findings).toEqual([
      {
        kind: 'import',
        path: 'packages/sdk/test/host.int.test.ts',
        line: 1,
        imported: '@northmes/server',
      },
      {
        kind: 'import',
        path: 'packages/sdk/test/host.int.test.ts',
        line: 2,
        imported: '@northmes/module-planning',
      },
      {
        kind: 'import',
        path: 'packages/sdk/test/host.int.test.ts',
        line: 3,
        imported: '@northmes/server',
      },
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
          text: "import { CommandBus } from '@northmes/module-core';\n",
        },
      ],
    );

    expect(findings).toEqual([
      {
        kind: 'import',
        path: 'examples/plugin-validator/test/validator.test.ts',
        line: 1,
        imported: '@northmes/module-core',
      },
    ]);
  });
});
