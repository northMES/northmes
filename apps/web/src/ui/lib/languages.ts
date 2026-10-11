// SPDX-License-Identifier: AGPL-3.0-or-later

const names = new Intl.DisplayNames(['en'], { type: 'language' });

/** A language's English name from its BCP 47 tag, such as Swedish for sv; the tag if it has none. */
export function languageName(tag: string): string {
  return names.of(tag) ?? tag;
}

/** The languages of Europe that master data can be translated into, by their BCP 47 tags. */
const europeanTags = [
  'bg',
  'ca',
  'cs',
  'cy',
  'da',
  'de',
  'el',
  'en',
  'es',
  'et',
  'eu',
  'fi',
  'fr',
  'ga',
  'gl',
  'hr',
  'hu',
  'is',
  'it',
  'lb',
  'lt',
  'lv',
  'mk',
  'mt',
  'nb',
  'nl',
  'nn',
  'pl',
  'pt',
  'ro',
  'ru',
  'se',
  'sk',
  'sl',
  'sq',
  'sr',
  'sv',
  'tr',
  'uk',
];

/**
 * The languages a translation of master data offers, sorted by their English names (ADR 0053):
 * the product ships in every European language over time, so its data can be translated into
 * each.
 */
export const dataLanguages: readonly { readonly value: string; readonly label: string }[] =
  europeanTags
    .map((tag) => ({ value: tag, label: languageName(tag) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'en'));
