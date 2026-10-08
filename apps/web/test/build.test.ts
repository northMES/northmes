// SPDX-License-Identifier: AGPL-3.0-or-later
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, defaultClientConditions, mergeConfig } from 'vite';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import config from '../vite.config.ts';

interface ManifestChunk {
  readonly file: string;
  readonly isEntry?: boolean;
  readonly isDynamicEntry?: boolean;
  readonly dynamicImports?: readonly string[];
}

/** Builds the web with its own vite.config.ts into a fresh folder and returns that folder. */
async function buildWeb() {
  const outDir = mkdtempSync(join(tmpdir(), 'northmes-web-'));
  onTestFinished(() => rmSync(outDir, { recursive: true, force: true }));
  // Vite keeps a NODE_ENV that is already set, and Vitest sets it to test.
  vi.stubEnv('NODE_ENV', 'production');
  onTestFinished(() => {
    vi.unstubAllEnvs();
  });
  await build(
    mergeConfig(config({ command: 'build', mode: 'production' }), {
      root: fileURLToPath(new URL('../', import.meta.url)),
      configFile: false,
      logLevel: 'silent',
      build: { outDir, emptyOutDir: true, manifest: true },
      // Workspace packages resolve to their source, as in every test (ADR 0058).
      resolve: { conditions: ['@northmes/source', ...defaultClientConditions] },
    }),
  );
  return outDir;
}

describe('the web build', () => {
  it("E02-S05 the web builds to static files with each module's screens in a chunk of their own", async () => {
    const outDir = await buildWeb();
    const manifest = JSON.parse(
      readFileSync(join(outDir, '.vite', 'manifest.json'), 'utf8'),
    ) as Record<string, ManifestChunk>;

    expect(existsSync(join(outDir, 'index.html'))).toBe(true);
    // config.json is the host's, so the build ships none.
    expect(existsSync(join(outDir, 'config.json'))).toBe(false);
    expect(manifest['index.html']?.isEntry).toBe(true);
    expect(manifest['index.html']?.dynamicImports).toContain('src/modules/planning/screens.ts');
    expect(manifest['src/modules/planning/screens.ts']?.isDynamicEntry).toBe(true);
  });
});
