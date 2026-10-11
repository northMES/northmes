// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { dataLanguages, languageName } from '../../../src/ui/lib/languages.ts';

describe('languages', () => {
  it('E06-S06 a language is named in English by its tag, and a tag with a region by both', () => {
    expect(languageName('sv')).toBe('Swedish');
    expect(languageName('de-AT')).toBe('Austrian German');
  });

  it("E06-S06 the data languages are Europe's, sorted by their English names", () => {
    const names = dataLanguages.map(({ label }) => label);

    expect(names).toContain('Finnish');
    expect(names).toContain('English');
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
  });
});
