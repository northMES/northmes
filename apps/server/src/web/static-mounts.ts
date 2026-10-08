// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ServerResponse } from 'node:http';
import { basename } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { CatalogEntry } from '../catalog/check-catalog.ts';

/**
 * The files of a remote whose names stay the same from build to build. A browser asks the server
 * again before it uses its copy of one; every other file has a content hash in its name.
 */
const FIXED_NAMES = new Set(['mf-manifest.json', 'mf-stats.json', 'remoteEntry.js']);

/** Serves the built remote of each catalog module with a web block at /modules/<id>/<version>/. */
export function mountStatic(app: NestExpressApplication, catalog: readonly CatalogEntry[]): void {
  for (const { manifest, webDir } of catalog) {
    if (!manifest.web || webDir === undefined) continue;
    app.useStaticAssets(webDir, {
      prefix: `/modules/${manifest.id}/${manifest.version}/`,
      index: false,
      fallthrough: false,
      setHeaders: (response: ServerResponse, path: string) => {
        const fixed = FIXED_NAMES.has(basename(path));
        response.setHeader(
          'Cache-Control',
          fixed ? 'no-cache' : 'public, max-age=31536000, immutable',
        );
      },
    });
  }
}
