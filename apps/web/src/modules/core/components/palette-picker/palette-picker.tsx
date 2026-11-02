// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { paletteColors } from '@northmes/contracts';
import { RadioGroup, RadioGroupItem } from '../../../../ui/primitives/radio-group.tsx';
import { colorText } from '../../equipment-group-facts.ts';

/** One of the 20 palette colors, palette-1 to palette-20. */
export type PaletteColor = (typeof paletteColors)[number];

export interface PalettePickerProps {
  /** The form field the picker sets, which its radios carry as their name. */
  readonly name: string;
  /** The id of the element that names the picker, such as the Color label. */
  readonly labelledBy: string;
  /** The id of the hint under the picker. */
  readonly describedBy?: string;
  /** The picked color, or none. */
  readonly value: string | undefined;
  readonly onChange: (color: PaletteColor) => void;
  readonly disabled?: boolean;
  /** The codes of the other rows that use each color, which each swatch names. */
  readonly usersOf?: (color: PaletteColor) => readonly string[];
}

/**
 * The 20 palette colors as one radio group of swatches (design #729, EG5), five a row on a narrow
 * screen and ten on a wide one. Each radio is named "Color 3", or "Color 3, used by MACH" when
 * other rows use it, and its swatch shows the number and those codes.
 */
export function PalettePicker({
  name,
  labelledBy,
  describedBy,
  value,
  onChange,
  disabled = false,
  usersOf = () => [],
}: PalettePickerProps) {
  return (
    <RadioGroup
      aria-labelledby={labelledBy}
      {...(describedBy !== undefined && { 'aria-describedby': describedBy })}
      value={value ?? ''}
      onValueChange={(picked) => onChange(String(picked) as PaletteColor)}
      disabled={disabled}
      name={name}
      className="grid grid-cols-5 gap-2 sm:grid-cols-10"
    >
      {paletteColors.map((each) => {
        const usedBy = usersOf(each);
        // The radio takes its name from the label, "Color 1, used by HEAT", while the swatch
        // shows the number and the codes.
        const label =
          usedBy.length === 0
            ? colorText(each)
            : `${colorText(each)}, used by ${usedBy.join(', ')}`;
        return (
          // biome-ignore lint/a11y/noLabelWithoutControl: the radio inside is the control.
          <label
            key={each}
            className="flex cursor-pointer flex-col items-center gap-1 rounded-md border border-transparent p-1 has-data-checked:border-foreground"
          >
            <span
              aria-hidden
              className="h-8 w-full rounded-sm border border-border"
              style={{ background: `var(--${each})` }}
            />
            <span className="sr-only">{label}</span>
            <span className="flex items-center gap-1.5 text-xs">
              <RadioGroupItem value={each} />
              <span aria-hidden>{each.replace('palette-', '')}</span>
            </span>
            <span aria-hidden className="min-h-4 font-mono text-tick text-muted-foreground">
              {usedBy.join(', ')}
            </span>
          </label>
        );
      })}
    </RadioGroup>
  );
}
