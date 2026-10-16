// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { z } from 'zod';

/**
 * Whether a tag is a BCP 47 tag that starts with a language of two or three letters, such as sv,
 * en-GB, zh-Hant-TW, sl-rozaj or en-US-u-ca-gregory (ADR 0053). Intl judges the rest of the tag;
 * the language comes first so that a word such as "english", which Intl would take as a language
 * subtag, is refused.
 */
function isLanguageTag(tag: string): boolean {
  if (!/^[a-z]{2,3}(-|$)/i.test(tag)) return false;
  try {
    return Intl.getCanonicalLocales(tag).length === 1;
  } catch {
    return false;
  }
}

/** A BCP 47 tag in its canonical form, such as en-GB for EN-gb. */
const locale = z
  .string()
  .trim()
  .refine(isLanguageTag, 'Choose a language.')
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
  })
  .describe(
    'The translations of the translatable fields, at most one per field and language and 50 in all.',
  );

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
