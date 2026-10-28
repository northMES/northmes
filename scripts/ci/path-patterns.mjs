// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The pattern syntax that .github/risk-paths (ADR 0086) and .github/docs-paths (ADR 0088) share,
// read as CODEOWNERS reads its patterns.

import { escapeRegExp } from './pull-request.mjs';

/**
 * A matcher for one pattern: a leading slash or a slash inside anchors the pattern at the root, a
 * pattern with no slash matches at any depth, * and ? stay within one folder, ** crosses folders, a
 * pattern that names a folder covers everything below it, and a pattern that ends in /* covers only
 * the files directly in its folder. A pattern with whitespace (an inline comment or an owner), ! or
 * [ throws, because it would never match and so would let a change through.
 * @param {string} pattern
 * @param {string} file the file the pattern comes from, named in the error
 * @returns {RegExp}
 */
export function pathMatcher(pattern, file) {
  if (/[\s![]/.test(pattern)) {
    throw new Error(
      `${file} has the pattern "${pattern}", with whitespace, ! or [, which the checks do not read.`,
    );
  }
  const folderOnly = pattern.endsWith('/');
  const trimmed = pattern.replace(/^\//, '').replace(/\/$/, '');
  const anchored = pattern.startsWith('/') || trimmed.includes('/');
  let source = '';
  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index] ?? '';
    if (trimmed.startsWith('**/', index)) {
      source += '(?:.*/)?';
      index += 2;
    } else if (trimmed.startsWith('**', index)) {
      source += '.*';
      index += 1;
    } else if (char === '*') {
      source += '[^/]*';
    } else if (char === '?') {
      source += '[^/]';
    } else {
      source += escapeRegExp(char);
    }
  }
  const prefix = anchored ? '^' : '^(?:.*/)?';
  const below = folderOnly ? '/.*' : trimmed.endsWith('/*') ? '' : '(?:/.*)?';
  return new RegExp(`${prefix}${source}${below}$`);
}

/** The lines of a pattern file that hold an entry: trimmed, without blank lines and # comments. */
export function entryLines(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));
}
