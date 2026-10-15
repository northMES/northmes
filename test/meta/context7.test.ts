import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { root } from './docs.ts';

interface Context7Config {
  folders?: string[];
  excludeFolders?: string[];
  excludeFiles?: string[];
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
});
