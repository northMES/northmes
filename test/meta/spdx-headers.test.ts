// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { scan, trackedSources } from '../../scripts/lint/spdx-headers.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));

type Finding =
  | { kind: 'license'; path: string; expected: string; found: string | undefined }
  | { kind: 'copyright'; path: string };

// A finding as a failing test prints it.
function describeFinding(finding: Finding): string {
  return finding.kind === 'license'
    ? `${finding.path} has license ${finding.found ?? '(none)'}, expected ${finding.expected}`
    : `${finding.path} has no SPDX-FileCopyrightText line`;
}

const packages = [
  { path: 'package.json', manifest: { name: 'northmes', license: 'AGPL-3.0-or-later' } },
  {
    path: 'apps/backend/package.json',
    manifest: { name: '@northmes/backend', license: 'AGPL-3.0-or-later' },
  },
  { path: 'packages/sdk/package.json', manifest: { name: '@northmes/sdk', license: 'MIT' } },
];

const skipped = { generated: ['apps/web/public/shared/*.js'], thirdPartySkills: ['tdd'] };

const agpl = 'AGPL-3.0-or-later';
const copyright = 'SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic';

describe('spdx-headers', () => {
  it('a source file with both lines and its package license passes, in each comment syntax', () => {
    const findings = scan(
      packages,
      [
        {
          path: 'apps/backend/src/a.ts',
          text: `// SPDX-License-Identifier: ${agpl}\n// ${copyright}\n`,
        },
        {
          path: 'packages/sdk/src/b.tsx',
          text: `// SPDX-License-Identifier: MIT\n// ${copyright}\n`,
        },
        { path: 'scripts/c.sql', text: `-- SPDX-License-Identifier: ${agpl}\n-- ${copyright}\n` },
        {
          path: 'scripts/d.sh',
          text: `#!/bin/sh\n# SPDX-License-Identifier: ${agpl}\n# ${copyright}\n`,
        },
        {
          path: 'scripts/e.mjs',
          text: `#!/usr/bin/env node\n// SPDX-License-Identifier: ${agpl}\n// ${copyright}\n`,
        },
        {
          path: 'apps/backend/src/f.css',
          text: `/* SPDX-License-Identifier: ${agpl} */\n/* ${copyright} */\n`,
        },
      ],
      skipped,
    );

    expect(findings).toEqual([]);
  });

  it('a source file without a license line, or with another package license, fails', () => {
    const findings = scan(
      packages,
      [
        { path: 'apps/backend/src/a.ts', text: `// ${copyright}\nexport {};\n` },
        {
          path: 'packages/sdk/src/b.ts',
          text: `// SPDX-License-Identifier: ${agpl}\n// ${copyright}\n`,
        },
        { path: 'e2e/c.spec.ts', text: `// SPDX-License-Identifier: MIT\n// ${copyright}\n` },
      ],
      skipped,
    );

    expect(findings).toEqual([
      { kind: 'license', path: 'apps/backend/src/a.ts', expected: agpl, found: undefined },
      { kind: 'copyright', path: 'apps/backend/src/a.ts' },
      { kind: 'license', path: 'packages/sdk/src/b.ts', expected: 'MIT', found: agpl },
      { kind: 'license', path: 'e2e/c.spec.ts', expected: agpl, found: 'MIT' },
    ]);
  });

  it('a source file without a copyright line fails, also after a shebang', () => {
    const findings = scan(
      packages,
      [
        { path: 'scripts/a.mjs', text: `// SPDX-License-Identifier: ${agpl}\nexport {};\n` },
        { path: 'deploy/b.sh', text: `#!/bin/sh\n# SPDX-License-Identifier: ${agpl}\nset -eu\n` },
        { path: 'scripts/c.sql', text: `-- SPDX-License-Identifier: ${agpl}\n--\n` },
      ],
      skipped,
    );

    expect(findings).toEqual([
      { kind: 'copyright', path: 'scripts/a.mjs' },
      { kind: 'copyright', path: 'deploy/b.sh' },
      { kind: 'copyright', path: 'scripts/c.sql' },
    ]);
  });

  it('generated files, migrations, shadcn primitives, fixture builds and third-party skills are skipped', () => {
    const findings = scan(
      packages,
      [
        'apps/web/src/modules/core/article.graphql.gen.ts',
        'apps/web/public/shared/react.js',
        'apps/backend/src/modules/core/migrations/20261008125631_article.sql',
        'apps/backend/test/fixtures/migrations/core/20260105080000_article.sql',
        'scripts/templates/table.sql',
        'apps/web/src/ui/primitives/button.tsx',
        'apps/web/src/ui/lib/use-mobile.ts',
        'apps/backend/test/fixtures/web/shell/assets/index-7b3e9a1c.js',
        'apps/backend/test/fixtures/plugins/web-hello/web/hello.js',
        '.claude/skills/tdd/scripts/run.sh',
        'docs/sources/x/y.ts',
        'docs/design/project/ui/support.js',
        'packages/sdk/dist/index.js',
        'README.md',
      ].map((path) => ({ path, text: 'export {};\n' })),
      skipped,
    );

    expect(findings).toEqual([]);
  });

  it('the repository passes', () => {
    const { packages, files, skipped } = trackedSources(root);

    expect(files.map(({ path }) => path)).toEqual(
      expect.arrayContaining(['packages/sdk/src/index.ts', 'scripts/gen.mjs', 'deploy/backup.sh']),
    );
    expect(skipped.generated).toContain('apps/web/src/**/*.graphql.gen.ts');
    expect(scan(packages, files, skipped).map(describeFinding)).toEqual([]);
  });
});
