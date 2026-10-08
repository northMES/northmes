// SPDX-License-Identifier: AGPL-3.0-or-later
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { scan, trackedModuleFiles } from '../../scripts/lint/module-boundaries.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));

// A finding as a failing test prints it: the file, the line and the import.
function describeFinding({ path, line, imported }: { path: string; line: number; imported: string }) {
  return `${path}:${line} imports ${imported}`;
}

describe('module-boundaries', () => {
  it("E02-S05 a module file that imports another module's internals fails naming the file, the line and the import", () => {
    const findings = scan([
      {
        path: 'apps/web/src/modules/quality/inspection-screen.tsx',
        text: [
          "import { planningModule } from '../planning/index.ts';",
          "import { BoardScreen } from '../planning/board-screen.tsx';",
          "import type { BoardOrder } from '../planning/board.graphql.ts';",
          "import { qualityRoutes } from './routes.tsx';",
          "const lazy = () => import('../planning/screens.ts');",
          '',
        ].join('\n'),
      },
      {
        path: 'apps/backend/src/modules/quality/quality.service.ts',
        text: [
          "import { PlanningApi } from '../planning/api.ts';",
          "import { ArticleService } from '../core/api/index.ts';",
          "export { OrderTable } from '../planning/db/order-table.ts';",
          "import { pool } from '../../db/pool.ts';",
          '',
        ].join('\n'),
      },
    ]);

    expect(findings.map(describeFinding)).toEqual([
      'apps/web/src/modules/quality/inspection-screen.tsx:2 imports ../planning/board-screen.tsx',
      'apps/web/src/modules/quality/inspection-screen.tsx:3 imports ../planning/board.graphql.ts',
      'apps/web/src/modules/quality/inspection-screen.tsx:5 imports ../planning/screens.ts',
      'apps/backend/src/modules/quality/quality.service.ts:3 imports ../planning/db/order-table.ts',
    ]);
  });

  it("E02-S05 a module may import another module's folder, its index file and its api file", () => {
    const findings = scan([
      {
        path: 'apps/web/src/modules/quality/routes.tsx',
        text: [
          "import { planningModule } from '../planning';",
          "import { planningLinks } from '../planning/index';",
          "import { releaseOrder } from '../planning/api.ts';",
          "import { BoardScreen } from './screens/board-screen.tsx';",
          "import { createShellRouter } from '../../shell.tsx';",
          '',
        ].join('\n'),
      },
    ]);

    expect(findings).toEqual([]);
  });

  it('E02-S05 the repository passes', () => {
    const files = trackedModuleFiles(root);

    expect(files.map(({ path }) => path)).toContain('apps/web/src/modules/planning/routes.tsx');
    expect(scan(files).map(describeFinding)).toEqual([]);
  });
});
