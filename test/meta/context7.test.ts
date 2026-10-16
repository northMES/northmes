// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { root } from './docs.ts';

interface Context7Config {
  folders?: string[];
  excludeFolders?: string[];
  excludeFiles?: string[];
  url?: string;
  public_key?: string;
}

// Context7 indexes the Markdown in the repository for coding agents (ADR 0048). Without a
// context7.json it reads everything, so the agent skills in .claude, the plan and the ADRs would
// answer questions about using NorthMES. Root-level Markdown is always read whatever `folders`
// says, so the rule files are kept out by name.
describe('context7.json', () => {
  const path = `${root}context7.json`;
  const config = () => JSON.parse(readFileSync(path, 'utf8')) as Context7Config;

  it('ADR0048 points Context7 at apps/docs and excludes docs/, .claude and the root rule files', () => {
    expect(existsSync(path), 'context7.json').toBe(true);
    expect(config().folders).toContain('apps/docs');
    expect(config().excludeFolders).toEqual(expect.arrayContaining(['./docs', './.claude']));
    expect(config().excludeFiles).toEqual(expect.arrayContaining(['AGENTS.md', 'CLAUDE.md']));
  });

  it('ADR0048 keeps the changelog and license out, since setting exclusions drops the defaults', () => {
    expect(config().excludeFiles).toEqual(expect.arrayContaining(['CHANGELOG.md', 'LICENSE.md']));
  });

  // Claiming the library on Context7 ties it to this repository: Context7 checks that the
  // repository's context7.json names the library's url and its public key, which is meant to be
  // public.
  it('ADR0048 claims the northmes/northmes library on Context7', () => {
    expect(config().url).toBe('https://context7.com/northmes/northmes');
    expect(config().public_key).toMatch(/^pk_\w+$/);
  });
});
