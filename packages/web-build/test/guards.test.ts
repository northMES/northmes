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
  onTestFinished(() => {
    vi.unstubAllEnvs();
  });
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

// One entry of the shared list in mf-manifest.json.
interface SharedEntry {
  readonly name: string;
  readonly singleton: boolean;
  readonly requiredVersion: string | false;
  readonly assets: { readonly js: { readonly sync: string[]; readonly async: string[] } };
}

function byName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name);
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

  it('E02-S05 a remote shares each singleton of ADR 0019 except @northmes/ui, each subpath as its own key, with no copy of its own', async () => {
    const manifest = manifestOf(await buildFixture('remote-zod-contracts'));

    // A shared entry lists the remote's own copy of the package under assets, and import: false
    // leaves those lists empty.
    const shared = manifest.shared.map((entry: SharedEntry) => ({
      name: entry.name,
      singleton: entry.singleton,
      requiredVersion: entry.requiredVersion,
      ownCopy: [...entry.assets.js.sync, ...entry.assets.js.async],
    }));
    expect(shared.sort(byName)).toEqual(
      [
        'react',
        'react-dom',
        'react/jsx-runtime',
        '@tanstack/react-router',
        '@apollo/client',
        '@apollo/client/react',
        '@northmes/web-sdk',
      ]
        .map((name) => ({ name, singleton: true, requiredVersion: false, ownCopy: [] }))
        .sort(byName),
    );
  });

  it('E02-S05 a remote bundling @apollo/client fails naming the package', async () => {
    await expect(buildFixture('remote-apollo')).rejects.toThrow(
      /this remote bundles .*@apollo\/client/,
    );
  });

  it('E02-S05 a remote bundling graphql fails naming the package', async () => {
    await expect(buildFixture('remote-graphql')).rejects.toThrow(/this remote bundles .*graphql/);
  });

  it('E02-S05 a remote under modules/*/web that emits CSS fails', async () => {
    await expect(buildFixture('remote-css')).rejects.toThrow(/this remote emits CSS/);
  });

  it('E02-S05 a remote whose defineWebModule version differs from its manifest fails naming both versions', async () => {
    const built = buildFixture('remote-version', { version: '0.4.0' });

    await expect(built).rejects.toThrow(/defineWebModule .*version 0\.3\.0/);
    await expect(built).rejects.toThrow(/manifest .*version 0\.4\.0/);
  });
});
