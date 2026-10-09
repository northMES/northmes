// SPDX-License-Identifier: AGPL-3.0-or-later
import { useId } from 'react';
import { fieldId } from '../../../../ui/lib/field-id.ts';
import { Checkbox } from '../../../../ui/primitives/checkbox.tsx';
import { Label } from '../../../../ui/primitives/label.tsx';
import { RadioGroup, RadioGroupItem } from '../../../../ui/primitives/radio-group.tsx';

/** Where an article is used, as core.createArticle and core.setArticlePlants take it (ADR 0073). */
export interface PlantsChoice {
  readonly allPlants: boolean;
  /** The slugs of the chosen plants; empty with allPlants. */
  readonly plants: readonly string[];
}

/** A plant the field offers. */
export interface PlantOption {
  readonly slug: string;
  readonly name: string;
}

export interface ArticlePlantsFieldProps {
  /** The plants of the company, in the order the field lists them. */
  readonly options: readonly PlantOption[];
  readonly value: PlantsChoice;
  readonly onChange: (value: PlantsChoice) => void;
  /** The message under the field, such as Choose at least one plant. */
  readonly error?: string | undefined;
  readonly disabled?: boolean;
}

/**
 * The message of a choice that names no plant, or undefined for one that names a plant or All
 * plants. A plant's pages show only the articles assigned to it, so the web never creates an
 * article that no plant shows.
 */
export function plantsChoiceError({ allPlants, plants }: PlantsChoice): string | undefined {
  return allPlants || plants.length > 0 ? undefined : 'Choose at least one plant, or All plants.';
}

/**
 * The Plants field of an article (ADR 0073), for a user who holds core.article:assign at the
 * company: Chosen plants with a checkbox per plant of the company, or All plants, which also
 * covers plants the company adds later. No design frame draws it yet; it follows the radio and
 * checkbox patterns of design core-304.
 */
export function ArticlePlantsField({
  options,
  value,
  onChange,
  error,
  disabled = false,
}: ArticlePlantsFieldProps) {
  const legendId = useId();
  const errorId = useId();
  const describedBy = error === undefined ? undefined : errorId;
  return (
    <fieldset
      aria-labelledby={legendId}
      aria-describedby={describedBy}
      className="flex flex-col gap-3"
    >
      <p id={legendId} className="text-xs font-semibold">
        Plants
      </p>
      <RadioGroup
        aria-labelledby={legendId}
        value={value.allPlants ? 'all' : 'chosen'}
        onValueChange={(next) =>
          onChange(
            next === 'all'
              ? { allPlants: true, plants: [] }
              : { allPlants: false, plants: value.plants },
          )
        }
        disabled={disabled}
        className="flex flex-col gap-3"
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 text-sm">
            <RadioGroupItem id={fieldId('plants-chosen')} value="chosen" />
            <Label htmlFor={fieldId('plants-chosen')} className="font-normal">
              Chosen plants
            </Label>
          </div>
          {!value.allPlants && (
            <ul className="ml-7 flex flex-col gap-2">
              {options.map((option) => {
                const id = `${fieldId('plants')}-${option.slug}`;
                const checked = value.plants.includes(option.slug);
                return (
                  <li key={option.slug} className="flex items-center gap-3 text-sm">
                    <Checkbox
                      id={id}
                      checked={checked}
                      disabled={disabled}
                      aria-invalid={error !== undefined || undefined}
                      onCheckedChange={(next) =>
                        onChange({
                          allPlants: false,
                          plants: next
                            ? [...value.plants, option.slug]
                            : value.plants.filter((slug) => slug !== option.slug),
                        })
                      }
                    />
                    <Label htmlFor={id} className="font-normal">
                      {option.name}
                    </Label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="flex items-start gap-3 text-sm">
          <RadioGroupItem
            id={fieldId('plants-all')}
            value="all"
            aria-describedby={`${fieldId('plants-all')}-hint`}
            className="mt-0.5"
          />
          <span className="flex flex-col">
            <Label htmlFor={fieldId('plants-all')} className="font-normal">
              All plants
            </Label>
            <span id={`${fieldId('plants-all')}-hint`} className="text-xs text-muted-foreground">
              Also the plants the company adds later.
            </span>
          </span>
        </div>
      </RadioGroup>
      {error !== undefined && (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}
