// SPDX-License-Identifier: MIT
import { z } from 'zod';

/**
 * A language tag as translations take it: a language of two or three letters, then optionally a
 * script and a region, such as sv, en-GB or zh-Hant-TW. Private-use and extension subtags are not
 * taken.
 */
const languageTag = /^[a-z]{2,3}(-[a-z]{4})?(-([a-z]{2}|\d{3}))?$/i;

/** A BCP 47 tag in its canonical form, such as en-GB for EN-gb. */
const locale = z
  .string()
  .trim()
  .refine((tag) => languageTag.test(tag), 'Choose a language.')
  .transform((tag) => Intl.getCanonicalLocales(tag)[0] ?? tag);

/**
 * One translation of a translatable field of master data, such as an article's name in English
 * (ADR 0053): the field, the locale as a BCP 47 tag, and the text, trimmed, 1 to 200 characters.
 */
export const translation = z.object({
  field: z.string().regex(/^[a-z][a-zA-Z0-9]*$/),
  locale,
  text: z
    .string()
    .trim()
    .min(1, 'Enter the translation, or remove it.')
    .max(200, {
      error: (issue) =>
        `A translation can be 1 to 200 characters. It has ${String(issue.input).length}.`,
    }),
});

export type Translation = z.output<typeof translation>;

/**
 * The translations of a record's translatable fields, at most one per field and locale, and at
 * most 50 in all.
 */
export const translations = z
  .array(translation)
  .max(50)
  .superRefine((list, context) => {
    const seen = new Set<string>();
    list.forEach(({ field, locale: tag }, index) => {
      const key = `${field} ${tag}`;
      if (seen.has(key)) {
        context.addIssue({
          code: 'custom',
          path: [index, 'locale'],
          message: `The ${field} already has a translation into this language.`,
        });
      }
      seen.add(key);
    });
  });

/** A translatable text: its value in the company's data language and its translations. */
export interface LocalizedText {
  readonly name: string;
  readonly translations: readonly Translation[];
}

/**
 * The text of `field` for a requested locale (ADR 0053): the translation into exactly that tag,
 * then into its base language, then the stored value, `name`.
 */
export function resolveLocalized(
  { name, translations: stored }: LocalizedText,
  requested: string,
  field = 'name',
): string {
  const own = stored.filter((each) => each.field === field);
  const [tag] = Intl.getCanonicalLocales(requested);
  const base = tag?.split('-')[0];
  return (
    own.find((each) => each.locale === tag)?.text ??
    own.find((each) => each.locale === base)?.text ??
    name
  );
}
