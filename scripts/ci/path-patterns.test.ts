// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import { entryLines, pathMatcher } from './path-patterns.mjs';

describe('entryLines', () => {
  it('ADR0086 keeps the entries of a pattern file, trimmed, without blank lines and # comments', () => {
    const text = [
      '# Paths where a wrong merge is expensive.',
      '  # An indented comment.',
      '',
      '  /.github/  ',
      '\t**/migrations/**',
      '   ',
      'Dockerfile',
      '',
    ].join('\r\n');
    expect(entryLines(text)).toEqual(['/.github/', '**/migrations/**', 'Dockerfile']);
  });
});

describe('pathMatcher', () => {
  it('ADR0086 a leading slash anchors the pattern at the root and a folder covers everything below it', () => {
    const matcher = pathMatcher('/.github/', '.github/risk-paths');
    expect(matcher.test('.github/workflows/ci.yml')).toBe(true);
    expect(matcher.test('.github')).toBe(false);
    expect(matcher.test('apps/.github/x')).toBe(false);
  });

  it('ADR0086 a pattern without a slash matches a file or folder of that name at any depth', () => {
    const matcher = pathMatcher('Dockerfile', '.github/risk-paths');
    expect(matcher.test('Dockerfile')).toBe(true);
    expect(matcher.test('apps/backend/Dockerfile')).toBe(true);
    expect(matcher.test('apps/Dockerfile.dev')).toBe(false);
  });

  it('ADR0086 a slash inside the pattern anchors it, and a folder named without a trailing slash still covers its files', () => {
    const matcher = pathMatcher('apps/backend/src/db', '.github/risk-paths');
    expect(matcher.test('apps/backend/src/db')).toBe(true);
    expect(matcher.test('apps/backend/src/db/client.ts')).toBe(true);
    expect(matcher.test('x/apps/backend/src/db/client.ts')).toBe(false);
  });

  it('ADR0086 * and ? stay within one folder and ** crosses folders', () => {
    const star = pathMatcher('/apps/backend/src/modules/*/permissions.ts', '.github/risk-paths');
    expect(star.test('apps/backend/src/modules/core/permissions.ts')).toBe(true);
    expect(star.test('apps/backend/src/modules/core/api/permissions.ts')).toBe(false);
    const question = pathMatcher('/docs/adr/00?8-*.md', '.github/docs-paths');
    expect(question.test('docs/adr/0088-docs.md')).toBe(true);
    expect(question.test('docs/adr/00188-docs.md')).toBe(false);
    expect(question.test('docs/adr/00/8-docs.md')).toBe(false);
    const stars = pathMatcher('**/migrations/**', '.github/risk-paths');
    expect(stars.test('apps/backend/src/db/migrations/0001.ts')).toBe(true);
    expect(stars.test('migrations/0001.ts')).toBe(true);
    expect(stars.test('apps/backend/src/migration/0001.ts')).toBe(false);
  });

  it('ADR0086 a pattern that ends in /* covers only the files directly in its folder', () => {
    const matcher = pathMatcher('/scripts/ci/*', '.github/risk-paths');
    expect(matcher.test('scripts/ci/risk-gate.mjs')).toBe(true);
    expect(matcher.test('scripts/ci/lib/risk-gate.mjs')).toBe(false);
  });

  it('ADR0086 a regular expression character in a pattern matches itself only', () => {
    const matcher = pathMatcher('/package.json', '.github/risk-paths');
    expect(matcher.test('package.json')).toBe(true);
    expect(matcher.test('packageXjson')).toBe(false);
  });

  it('ADR0086 a pattern with whitespace, ! or [ throws and names its file, because it would never match', () => {
    for (const pattern of ['/apps/ @owner', '!/apps/', '/apps/[ab]/']) {
      expect(() => pathMatcher(pattern, '.github/docs-paths')).toThrow(
        `.github/docs-paths has the pattern "${pattern}", with whitespace, ! or [, which the checks do not read.`,
      );
    }
  });
});
