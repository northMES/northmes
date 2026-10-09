// SPDX-License-Identifier: AGPL-3.0-or-later
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { scan, trackedModuleFiles } from '../../scripts/lint/module-boundaries.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));

// A finding as a failing test prints it: the file, the line and the import.
function describeFinding({
  path,
  line,
  imported,
}: {
  path: string;
  line: number;
  imported: string;
}) {
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
        path: 'apps/backend/src/modules/quality/core/inspection.service.ts',
        text: [
          "import { ProductionOrderService } from '../../planning/public-api.ts';",
          "export { ProductionOrderTable } from '../../planning/infrastructure/database.ts';",
          "import { pool } from '../../../db/pool.ts';",
          "import { InspectionTable } from '../infrastructure/database.ts';",
          '',
        ].join('\n'),
      },
    ]);

    expect(findings.map(describeFinding)).toEqual([
      'apps/web/src/modules/quality/inspection-screen.tsx:2 imports ../planning/board-screen.tsx',
      'apps/web/src/modules/quality/inspection-screen.tsx:3 imports ../planning/board.graphql.ts',
      'apps/web/src/modules/quality/inspection-screen.tsx:5 imports ../planning/screens.ts',
      'apps/backend/src/modules/quality/core/inspection.service.ts:2 imports ../../planning/infrastructure/database.ts',
    ]);
  });

  it('E02-S05 a backend module may import another module only through its public-api.ts', () => {
    const findings = scan([
      {
        path: 'apps/backend/src/modules/quality/quality.module.ts',
        text: [
          "import { ArticleServiceModule } from '../core/public-api.ts';",
          "import { ArticleService } from '../core/public-api';",
          "import { CoreModule } from '../core';",
          "import { Article } from '../core/index.ts';",
          "import { ArticleService as Api } from '../core/api/index.ts';",
          "import { articles } from '../core/api.ts';",
          "import { ArticleService as Core } from '../core/core/article.service.ts';",
          "import { InspectionModule } from './api/inspection/inspection.module.ts';",
          '',
        ].join('\n'),
      },
    ]);

    expect(findings.map(describeFinding)).toEqual([
      'apps/backend/src/modules/quality/quality.module.ts:3 imports ../core',
      'apps/backend/src/modules/quality/quality.module.ts:4 imports ../core/index.ts',
      'apps/backend/src/modules/quality/quality.module.ts:5 imports ../core/api/index.ts',
      'apps/backend/src/modules/quality/quality.module.ts:6 imports ../core/api.ts',
      'apps/backend/src/modules/quality/quality.module.ts:7 imports ../core/core/article.service.ts',
    ]);
  });

  it("E02-S05 a web module may import another module's folder, its index file and its api file", () => {
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
    expect(files.map(({ path }) => path)).toContain('apps/backend/src/modules/core/public-api.ts');
    expect(scan(files).map(describeFinding)).toEqual([]);
  });
});
