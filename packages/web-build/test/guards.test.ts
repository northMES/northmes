// SPDX-License-Identifier: MIT
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, defaultClientConditions, mergeConfig } from 'vite';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { defineRemoteConfig } from '../remote.mjs';

interface FixtureOptions {
  /** The version the module manifest declares, which defineRemoteConfig receives. */
  readonly version?: string;
}

/**
 * Builds the fixture remote in test/fixtures/<name> through defineRemoteConfig, with the fixture
 * name as the module id, into a fresh folder, and returns that folder.
 */
async function buildFixture(name: string, { version = '0.0.1' }: FixtureOptions = {}) {
  const outDir = mkdtempSync(join(tmpdir(), `northmes-${name}-`));
  onTestFinished(() => rmSync(outDir, { recursive: true, force: true }));
  // @module-federation/vite returns no plugins when it finds VITEST in the environment, unless
  // this variable is set.
  vi.stubEnv('MFE_VITE_NO_TEST_ENV_CHECK', 'true');
  onTestFinished(() => vi.unstubAllEnvs());
  const config = defineRemoteConfig({ id: name, version });
  await build(
    mergeConfig(config({ command: 'build', mode: 'production' }), {
      root: fileURLToPath(new URL(`./fixtures/${name}/`, import.meta.url)),
      configFile: false,
      logLevel: 'silent',
      build: { outDir, emptyOutDir: true },
      // Workspace packages resolve to their source, as in every test (ADR 0058).
      resolve: { conditions: ['@northmes/source', ...defaultClientConditions] },
    }),
  );
  return outDir;
}

// The mf-manifest.json the build wrote, which the server lists and the shell loads (ADR 0019).
function manifestOf(outDir: string) {
  return JSON.parse(readFileSync(join(outDir, 'mf-manifest.json'), 'utf8'));
}

// The text of every JavaScript file the build wrote.
function builtJavaScript(outDir: string): string {
  return readdirSync(outDir, { recursive: true, encoding: 'utf8' })
    .filter((path) => path.endsWith('.js'))
    .map((path) => readFileSync(join(outDir, path), 'utf8'))
    .join('\n');
}

describe('remote build guards', () => {
  it('E02-S05 a fixture remote that bundles zod and @northmes/planning-contracts passes', async () => {
    const outDir = await buildFixture('remote-zod-contracts');

    // The contract's command name comes from @northmes/planning-contracts, which holds the
    // remote's own copy of zod's schemas.
    expect(builtJavaScript(outDir)).toContain('planning.releaseProductionOrder');
  });

  it('E02-S05 a remote loads its files from /modules/<id>/<version>/ and exposes ./module', async () => {
    const manifest = manifestOf(await buildFixture('remote-zod-contracts'));

    expect(manifest.metaData.publicPath).toBe('/modules/remote-zod-contracts/0.0.1/');
    expect(manifest.metaData.remoteEntry.name).toBe('remoteEntry.js');
    expect(manifest.exposes.map((expose: { path: string }) => expose.path)).toEqual(['./module']);
  });
});
