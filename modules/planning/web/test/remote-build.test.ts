// SPDX-License-Identifier: AGPL-3.0-or-later
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, defaultClientConditions, mergeConfig } from 'vite';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import planningPackage from '../../package.json' with { type: 'json' };
import config from '../vite.config.ts';

/**
 * Builds the planning remote with its own vite.config.ts into a fresh folder and returns that
 * folder. The build runs the guards of defineRemoteConfig on the remote's real sources.
 */
async function buildRemote() {
  const outDir = mkdtempSync(join(tmpdir(), 'northmes-planning-web-'));
  onTestFinished(() => rmSync(outDir, { recursive: true, force: true }));
  // @module-federation/vite returns no plugins when it finds VITEST in the environment, unless
  // this variable is set.
  vi.stubEnv('MFE_VITE_NO_TEST_ENV_CHECK', 'true');
  // Vite keeps a NODE_ENV that is already set, and Vitest sets it to test. A build outside
  // production compiles JSX to react/jsx-dev-runtime, which is no share key in a build, so the
  // build would bundle React.
  vi.stubEnv('NODE_ENV', 'production');
  onTestFinished(() => {
    vi.unstubAllEnvs();
  });
  await build(
    mergeConfig(config({ command: 'build', mode: 'production' }), {
      root: fileURLToPath(new URL('../', import.meta.url)),
      configFile: false,
      logLevel: 'silent',
      build: { outDir, emptyOutDir: true },
      // Workspace packages resolve to their source, as in every test (ADR 0058).
      resolve: { conditions: ['@northmes/source', ...defaultClientConditions] },
    }),
  );
  return outDir;
}

describe('planning remote build', () => {
  it('E02-S05 the planning remote builds through defineRemoteConfig and exposes ./module', async () => {
    const outDir = await buildRemote();
    const manifest = JSON.parse(readFileSync(join(outDir, 'mf-manifest.json'), 'utf8'));

    expect(manifest.exposes.map((expose: { path: string }) => expose.path)).toEqual(['./module']);
    // The server mounts the remote at the version of the module manifest, which reads it from
    // modules/planning/package.json.
    expect(manifest.metaData.publicPath).toBe(`/modules/planning/${planningPackage.version}/`);
    expect(
      readdirSync(outDir, { recursive: true, encoding: 'utf8' }).filter((path) =>
        path.endsWith('.css'),
      ),
    ).toEqual([]);
  });
});
