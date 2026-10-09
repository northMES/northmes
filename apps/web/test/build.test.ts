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
    expect(css).toMatch(/--background:\s*oklch\((?:98\.5%|0?\.985) 0?\.002 250\)/);
    expect(css).toMatch(/--background:\s*oklch\((?:20\.5%|0?\.205) 0?\.005 250\)/);
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

  it("E04-S02 the built index.html links the stylesheet in its head before any script, and runs the theme script before the app's module (BO1, BO2)", async () => {
    const outDir = await buildWeb();
    const manifest = JSON.parse(
      readFileSync(join(outDir, '.vite', 'manifest.json'), 'utf8'),
    ) as Record<string, ManifestChunk>;
    const html = readFileSync(join(outDir, 'index.html'), 'utf8');
    const head = html.slice(0, html.indexOf('</head>'));
    const tags = [...head.matchAll(/<(link|script)\b[^>]*>/g)].map(([tag]) => tag);
    const attribute = (tag: string, name: string) =>
      new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];

    const [sheet] = manifest['index.html']?.css ?? [];
    const sheetAt = tags.findIndex(
      (tag) => attribute(tag, 'rel') === 'stylesheet' && attribute(tag, 'href') === `/${sheet}`,
    );
    const scripts = tags.flatMap((tag, at) => (tag.startsWith('<script') ? [at] : []));
    expect(sheetAt).toBeGreaterThanOrEqual(0);
    expect(scripts.length).toBeGreaterThan(0);
    expect(sheetAt).toBeLessThan(Math.min(...scripts));

    // The theme script is a classic script from the hashed assets, the only files the server
    // serves besides index.html, and it runs before the app's module.
    const themeAt = tags.findIndex((tag) =>
      /^\/assets\/theme-boot-[\w-]+\.js$/.test(attribute(tag, 'src') ?? ''),
    );
    const theme = tags[themeAt] as string;
    expect(attribute(theme, 'type')).toBeUndefined();
    expect(theme).not.toMatch(/\s(async|defer)\b/);
    expect(themeAt).toBe(Math.min(...scripts));
    expect(readFileSync(join(outDir, attribute(theme, 'src') as string), 'utf8')).toBe(
      readFileSync(new URL('../src/boot/theme-boot.js', import.meta.url), 'utf8'),
    );

    // The boot page's classes and the page's colours are in that stylesheet.
    const css = readFileSync(join(outDir, sheet as string), 'utf8');
    expect(css).toContain('.sr-only');
    expect(css).toContain('.animate-spin');
    expect(css).toMatch(/body\{background-color:var\(--background\);color:var\(--foreground\)\}/);
  });
});
