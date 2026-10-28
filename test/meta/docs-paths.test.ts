// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { docsPathsFile, parseDocsPaths } from '../../scripts/ci/pr-docs.mjs';
import { root, trackedFiles } from './docs.ts';

// .github/docs-paths maps each developer-facing surface to the pages under apps/docs that describe
// it, or says none yet (ADR 0088). PR / pr docs reads it, and the code-reviewer agent reads the
// pages it names. The file is one more thing to keep in step with the folders, which this test does.

const tracked = trackedFiles();
const entries = parseDocsPaths(readFileSync(`${root}${docsPathsFile}`, 'utf8'));
const patterns = entries.map(({ pattern }) => pattern);

// The ids of the folders directly under a prefix, from the tracked files.
function folders(prefix: string): string[] {
  const ids = new Set<string>();
  for (const path of tracked) {
    if (path.startsWith(prefix)) {
      const [id = ''] = path.slice(prefix.length).split('/');
      if (path.slice(prefix.length).includes('/')) ids.add(id);
    }
  }
  return [...ids].sort();
}

// The surfaces ADR 0088 maps: the HTTP surface, the MIT packages, each module and its contracts,
// the configuration schema and each example plugin.
const requiredSurfaces = [
  '/apps/backend/src/http/',
  '/packages/sdk/',
  '/packages/web-sdk/',
  '/apps/backend/src/boot/config-file.ts',
  ...folders('modules/').map((id) => `/modules/${id}/`),
  ...folders('modules/')
    .filter((id) => [...tracked].some((path) => path.startsWith(`modules/${id}/contracts/`)))
    .map((id) => `/modules/${id}/contracts/`),
  ...folders('examples/').map((id) => `/examples/${id}/`),
];

describe('docs paths', () => {
  it('ADR0088 every pattern matches a tracked file', () => {
    const dead = entries
      .filter(({ matcher }) => ![...tracked].some((path) => matcher.test(path)))
      .map(({ pattern }) => pattern);

    expect(entries.length).toBeGreaterThan(0);
    expect(dead).toEqual([]);
  });

  it('ADR0088 every page an entry names is a tracked file under apps/docs', () => {
    const missing = entries
      .flatMap(({ pattern, pages }) => pages.map((page) => ({ pattern, page })))
      .filter(({ page }) => !tracked.has(page))
      .map(({ pattern, page }) => `${pattern}: ${page}`);

    expect(missing).toEqual([]);
  });

  it('ADR0088 the HTTP surface, the MIT packages, every module, every contracts package, the configuration schema and every example have an entry', () => {
    expect(requiredSurfaces.length).toBeGreaterThan(8);
    expect(patterns).toEqual(expect.arrayContaining(requiredSurfaces));
  });

  it('ADR0088 no entry maps a screen or a use guide, which come in the docs task of the epic', () => {
    const screens = patterns.filter((pattern) => pattern.startsWith('/apps/web/'));
    const useGuides = entries
      .flatMap(({ pages }) => pages)
      .filter((page) => page.startsWith('apps/docs/use/'));

    expect(screens).toEqual([]);
    expect(useGuides).toEqual([]);
  });

  it('ADR0088 each surface has one entry', () => {
    expect([...new Set(patterns)]).toEqual(patterns);
  });
});
