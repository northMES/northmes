// SPDX-License-Identifier: AGPL-3.0-or-later
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { CatalogEntry } from '../catalog/check-catalog.ts';

/** Serves the built remote of each catalog module with a web block at /modules/<id>/<version>/. */
export function mountStatic(app: NestExpressApplication, catalog: readonly CatalogEntry[]): void {
  for (const { manifest, webDir } of catalog) {
    if (!manifest.web || webDir === undefined) continue;
    app.useStaticAssets(webDir, {
      prefix: `/modules/${manifest.id}/${manifest.version}/`,
      index: false,
      fallthrough: false,
    });
  }
}
