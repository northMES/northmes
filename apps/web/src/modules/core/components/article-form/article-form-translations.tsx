// SPDX-License-Identifier: AGPL-3.0-or-later
import { CircleAlert, Plus, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useFieldArray, useWatch } from 'react-hook-form';
import { IconButton } from '../../../../ui/components/icon-button/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { fieldId } from '../../../../ui/lib/field-id.ts';
import { dataLanguages, languageName } from '../../../../ui/lib/languages.ts';
import { fieldProps, type ZodForm } from '../../../../ui/lib/use-zod-form.ts';
import { Button } from '../../../../ui/primitives/button.tsx';
import { Input } from '../../../../ui/primitives/input.tsx';
import { NativeSelect, NativeSelectOption } from '../../../../ui/primitives/native-select.tsx';
import type { ArticleFields } from './article-form.tsx';

/** A field's error under its row, which describes the field it names. */
function RowError({ id, message }: { readonly id: string; readonly message: string | undefined }) {
  if (message === undefined) return null;
  return (
    <p id={id} className="flex items-start gap-1 text-xs text-destructive">
      <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
      {message}
    </p>
  );
}

/**
 * The translations of the article's name (design ui-222, DE7): one row per translation with its
 * language, its text and Remove, then Add translation. Add translation moves focus to the new
 * row's language; Remove moves it to the next row's language, else to Add translation (NA13), and
 * announces the translation it took out.
 */
export function ArticleFormTranslations({ form }: { readonly form: ZodForm<ArticleFields> }) {
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'translations' });
  const locales = useWatch({ control: form.control, name: 'translations' }) ?? [];
  const addButton = useRef<HTMLButtonElement>(null);
  // The row whose language takes focus once the rows rendered after a removal, or -1 for Add.
  const focusAfterRemove = useRef<number | undefined>(undefined);

  useEffect(() => {
    const target = focusAfterRemove.current;
    if (target === undefined) return;
    focusAfterRemove.current = undefined;
    if (target < fields.length) {
      document.getElementById(fieldId(`translations.${target}.locale`))?.focus();
    } else {
      addButton.current?.focus();
    }
  }, [fields]);

  return (
    <div className="flex flex-col gap-2">
      <p id="translations-label" className="text-xs font-semibold text-foreground">
        Translations <span className="font-normal text-muted-foreground">(optional)</span>
      </p>
      {fields.length > 0 && (
        <ul aria-labelledby="translations-label" className="flex flex-col gap-2">
          {fields.map((row, index) => {
            const number = index + 1;
            const locale = fieldProps(form, `translations.${index}.locale`);
            const text = fieldProps(form, `translations.${index}.text`);
            const localeId = fieldId(`translations.${index}.locale`);
            const textId = fieldId(`translations.${index}.text`);
            const tag = locales[index]?.locale ?? '';
            const { error: localeError, ...localeRegister } = locale;
            const { error: textError, ...textRegister } = text;
            return (
              <li key={row.id} className="flex flex-col gap-1">
                <div className="grid grid-cols-[minmax(9rem,12rem)_1fr_auto] items-start gap-2">
                  <NativeSelect
                    {...localeRegister}
                    id={localeId}
                    className="w-full"
                    aria-label={`Language of translation ${number}`}
                    aria-invalid={localeError !== undefined || undefined}
                    aria-describedby={localeError === undefined ? undefined : `${localeId}-error`}
                  >
                    <NativeSelectOption value="">Choose a language</NativeSelectOption>
                    {dataLanguages.map((language) => (
                      <NativeSelectOption key={language.value} value={language.value}>
                        {language.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <Input
                    {...textRegister}
                    id={textId}
                    autoComplete="off"
                    lang={tag === '' ? undefined : tag}
                    aria-label={`Translation ${number}`}
                    aria-invalid={textError !== undefined || undefined}
                    aria-describedby={textError === undefined ? undefined : `${textId}-error`}
                  />
                  <IconButton
                    variant="ghost"
                    label={
                      tag === ''
                        ? `Remove translation ${number}`
                        : `Remove the ${languageName(tag)} translation`
                    }
                    onClick={() => {
                      focusAfterRemove.current = index;
                      remove(index);
                      announce(
                        tag === ''
                          ? `Translation ${number} removed`
                          : `${languageName(tag)} translation removed`,
                      );
                    }}
                  >
                    <X aria-hidden />
                  </IconButton>
                </div>
                <RowError id={`${localeId}-error`} message={localeError} />
                <RowError id={`${textId}-error`} message={textError} />
              </li>
            );
          })}
        </ul>
      )}
      <Button
        ref={addButton}
        type="button"
        variant="ghost"
        className="self-start"
        onClick={() =>
          append(
            { field: 'name', locale: '', text: '' },
            { focusName: `translations.${fields.length}.locale` },
          )
        }
      >
        <Plus aria-hidden />
        Add translation
      </Button>
    </div>
  );
}
