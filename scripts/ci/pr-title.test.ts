import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkTitle } from './pr-title.mjs';

const script = fileURLToPath(new URL('./pr-title.mjs', import.meta.url));

// Runs the script as the ci / pr title job does, with the title in PR_TITLE.
function run(title: string) {
  return spawnSync(process.execPath, [script], {
    env: { PATH: process.env.PATH, PR_TITLE: title },
    encoding: 'utf8',
  });
}

describe('ci / pr title', () => {
  it('accepts security(core): ...', () => {
    expect(checkTitle('security(core): end the sessions of a disabled user').ok).toBe(true);
  });

  it('accepts a title without a scope', () => {
    const types = 'feat fix security perf revert docs test ci chore refactor build'.split(' ');

    for (const type of types) {
      expect(checkTitle(`${type}: show late orders on the board`).ok, type).toBe(true);
    }
  });

  it('accepts ! before the colon for a breaking change', () => {
    expect(checkTitle('feat(planning)!: drop the legacy order import').ok).toBe(true);
    expect(checkTitle('chore!: require Node 26').ok).toBe(true);
  });

  it('fails a title that is not a Conventional Commit with an allowed type, naming the title', () => {
    const titles = [
      'Show late orders on the board',
      'style(web): sort the imports',
      'Feat(planning): show late orders on the board',
      'feat(planning) show late orders on the board',
      'feat(planning):',
    ];

    for (const title of titles) {
      const result = checkTitle(title);

      expect(result.ok, title).toBe(false);
      expect(result.message, title).toContain(JSON.stringify(title));
    }
  });

  it('the entry point reads PR_TITLE and fails a wrong title with an error annotation', () => {
    const failed = run('Show late orders on the board');
    const passed = run('feat(planning): show late orders on the board');

    expect(failed.status).toBe(1);
    expect(failed.stdout).toMatch(
      /^::error::The pull request title "Show late orders on the board"/,
    );
    expect(passed.status).toBe(0);
    expect(passed.stdout).toBe('');
  });

  // GitHub decodes %25, %0D and %0A in an annotation, so a title that holds %0A would otherwise show
  // a line break that the title does not have.
  it('the error annotation shows a title with % and a line break as typed, on one line', () => {
    const result = run('Fix 100%0A of it\n::warning::second line');

    expect(result.stdout.trimEnd().split('\n')).toHaveLength(1);
    expect(result.stdout).toContain('"Fix 100%250A of it\\n::warning::second line"');
  });
});
