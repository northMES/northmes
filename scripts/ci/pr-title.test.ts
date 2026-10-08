import { describe, expect, it } from 'vitest';
import { checkTitle } from './pr-title.mjs';

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
});
