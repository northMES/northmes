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
  readonly css?: readonly string[];
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

  it('E04-S01 the web build ships one stylesheet with the D1 tokens in both themes, the two-tone focus ring and self-hosted IBM Plex', async () => {
    const outDir = await buildWeb();
    const manifest = JSON.parse(
      readFileSync(join(outDir, '.vite', 'manifest.json'), 'utf8'),
    ) as Record<string, ManifestChunk>;
    const sheets = manifest['index.html']?.css ?? [];

    expect(sheets).toHaveLength(1);
    const css = readFileSync(join(outDir, sheets[0] as string), 'utf8');
    // Light on :root; dark when the system asks for it unless the page forces light, or when the
    // page forces dark.
    expect(css).toMatch(/--background:\s*oklch\(\s*0?\.985 0?\.002 250\)/);
    expect(css).toMatch(/--background:\s*oklch\(\s*0?\.205 0?\.005 250\)/);
    expect(css).toMatch(/@media\s*\(prefers-color-scheme:\s*dark\)/);
    expect(css).toMatch(/data-theme=["']?light/);
    expect(css).toMatch(/data-theme=["']?dark/);
    // The D1 focus ring: a 2 px outline in --focus-outline around a 2 px band in --focus-ring.
    expect(css).toMatch(/outline:\s*2px solid var\(--focus-outline\)/);
    expect(css).toMatch(/box-shadow:\s*0 0 0 2px var\(--focus-ring\)/);
    // Both families come from files in the build, never from a CDN.
    for (const family of ['IBM Plex Sans', 'IBM Plex Mono']) {
      expect(css).toContain(`font-family:${family}`);
    }
    const fontUrls = [...css.matchAll(/url\(([^)]+\.woff2)\)/g)].map(([, url]) => url as string);
    expect(fontUrls.length).toBeGreaterThan(0);
    for (const url of fontUrls) {
      expect(url).not.toMatch(/^(https?:)?\/\//);
      expect(existsSync(join(outDir, url.replace(/^\//, '')))).toBe(true);
    }
  });
});
