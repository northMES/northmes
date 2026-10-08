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
});
