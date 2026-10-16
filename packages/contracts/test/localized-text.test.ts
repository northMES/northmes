// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import { resolveLocalized, translations } from '../src/localized-text.ts';

const name = 'Fläns DN50 rostfri';
const stored = [
  { field: 'name', locale: 'en', text: 'Flange DN50 stainless' },
  { field: 'name', locale: 'sv', text: 'Fläns DN50 rostfri' },
  { field: 'name', locale: 'de-AT', text: 'Flansch DN50 Edelstahl, AT' },
  { field: 'note', locale: 'en', text: 'Drawing rev C' },
];

describe('localizedText', () => {
  it('E06-S04 a translation for the exact tag answers that tag', () => {
    expect(resolveLocalized({ name, translations: stored }, 'de-AT')).toBe(
      'Flansch DN50 Edelstahl, AT',
    );
  });

  it('E06-S04 a tag without a translation falls back to its base language, then to the name', () => {
    expect(resolveLocalized({ name, translations: stored }, 'en-GB')).toBe('Flange DN50 stainless');
    expect(resolveLocalized({ name, translations: stored }, 'de')).toBe(name);
    expect(resolveLocalized({ name, translations: stored }, 'fi')).toBe(name);
  });

  it("E06-S04 resolution reads only the field's own translations", () => {
    expect(resolveLocalized({ name: 'Ritning rev C', translations: stored }, 'en', 'note')).toBe(
      'Drawing rev C',
    );
  });

  it('E06-S04 translations keep each locale in its canonical BCP 47 form and trim the text', () => {
    const parsed = translations.parse([{ field: 'name', locale: 'EN-gb', text: '  Flange ' }]);

    expect(parsed).toEqual([{ field: 'name', locale: 'en-GB', text: 'Flange' }]);
  });

  it('E06-S04 a locale takes any BCP 47 tag of a language, with a variant or an extension too', () => {
    const parsed = translations.parse([
      { field: 'name', locale: 'sl-rozaj', text: 'Prirobnica' },
      { field: 'name', locale: 'en-us-u-ca-gregory', text: 'Flange' },
    ]);

    expect(parsed.map((each) => each.locale)).toEqual(['sl-rozaj', 'en-US-u-ca-gregory']);
  });

  it('E06-S04 a locale that is no BCP 47 tag is refused on its locale', () => {
    const parsed = translations.safeParse([{ field: 'name', locale: 'english', text: 'Flange' }]);

    expect(parsed.error?.issues).toMatchObject([
      { path: [0, 'locale'], message: 'Choose a language.' },
    ]);
  });

  it('E06-S04 an empty translation is refused on its text', () => {
    const parsed = translations.safeParse([{ field: 'name', locale: 'en', text: ' ' }]);

    expect(parsed.error?.issues).toMatchObject([
      { path: [0, 'text'], message: 'Enter the translation, or remove it.' },
    ]);
  });

  it('E06-S04 a second translation of one field into one language is refused on its locale', () => {
    const parsed = translations.safeParse([
      { field: 'name', locale: 'en', text: 'Flange' },
      { field: 'name', locale: 'EN', text: 'Flange, steel' },
    ]);

    expect(parsed.error?.issues).toMatchObject([
      { path: [1, 'locale'], message: 'The name already has a translation into this language.' },
    ]);
  });
});
