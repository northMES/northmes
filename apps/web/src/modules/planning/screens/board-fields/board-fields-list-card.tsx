// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Info } from 'lucide-react';
import { useId } from 'react';
import { FormSection } from '../../../../ui/components/form-section/index.ts';
import { Label } from '../../../../ui/primitives/label.tsx';
import { RadioGroup, RadioGroupItem } from '../../../../ui/primitives/radio-group.tsx';
import type { BoardFieldOption } from '../../board-fields.ts';
import { BoardFieldsEditor } from './board-fields-editor.tsx';
import type { BoardFieldsCatalog } from './board-fields-picker.tsx';

/** What a list card says about its setting (plan 07, Settings; #762). */
export interface BoardFieldsListText {
  readonly label: 'Block fields' | 'Hover fields';
  /** The setting's key, such as boardBlockFields. */
  readonly settingKey: string;
  readonly description: string;
  /** The default the board design recorded (#762, F0 assumption 10). */
  readonly defaultText: string;
  readonly effect: string;
  readonly addLabel: string;
  readonly emptyTitle: string;
  readonly emptyText: string;
  readonly limit?: number;
}

/**
 * One list as a setting card, as the planning rules page lays out a rule (#766; #762, BF1 and
 * BF2): the label, the key, what it does and its default; the company value; the plant's choice
 * between the company value and its own list; under its own list the editor across the card; and
 * a line on what the list does on the board and the Gantt.
 */
export function BoardFieldsListCard({
  text,
  plantName,
  companyIds,
  ownIds,
  optionOf,
  catalog,
  onChange,
}: {
  readonly text: BoardFieldsListText;
  readonly plantName: string;
  readonly companyIds: readonly string[];
  /** The plant's own list; null while it uses the company value. */
  readonly ownIds: readonly string[] | null;
  readonly optionOf: (id: string) => BoardFieldOption;
  readonly catalog: BoardFieldsCatalog;
  readonly onChange: (ids: readonly string[] | null) => void;
}) {
  const baseId = useId();
  const legendId = `${baseId}-plant`;
  const companyText =
    companyIds.length === 0 ? 'None' : companyIds.map((id) => optionOf(id).label).join(', ');
  return (
    <FormSection title={text.label} description={text.description}>
      <div className="grid gap-x-6 gap-y-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-1">
          <code className="font-mono text-xs text-muted-foreground">{text.settingKey}</code>
          <p className="text-xs text-muted-foreground">
            Default: {text.defaultText}. A plan proposal in plan 07, Settings.
          </p>
          <div className="mt-1 grid gap-0.5 rounded-md bg-muted px-2.5 py-2">
            <span className="text-xs text-muted-foreground">Company value</span>
            <b className="font-medium">{companyText}</b>
          </div>
        </div>
        <fieldset aria-labelledby={legendId} className="grid content-start gap-2">
          <p id={legendId} className="text-xs text-muted-foreground">
            {plantName} value
          </p>
          <RadioGroup
            aria-labelledby={legendId}
            value={ownIds === null ? 'company' : 'own'}
            onValueChange={(next) => onChange(next === 'company' ? null : [...companyIds])}
            className="grid gap-2"
          >
            <div className="flex items-center gap-2 text-sm">
              <RadioGroupItem id={`${baseId}-company`} value="company" />
              <Label htmlFor={`${baseId}-company`} className="font-normal">
                Use the company value
              </Label>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <RadioGroupItem id={`${baseId}-own`} value="own" />
              <Label htmlFor={`${baseId}-own`} className="font-normal">
                Set for {plantName}
              </Label>
            </div>
          </RadioGroup>
        </fieldset>
      </div>
      {ownIds !== null && (
        <BoardFieldsEditor
          label={text.label}
          ids={ownIds}
          optionOf={optionOf}
          catalog={catalog}
          {...(text.limit !== undefined && { limit: text.limit })}
          addLabel={text.addLabel}
          emptyTitle={text.emptyTitle}
          emptyText={text.emptyText}
          onChange={onChange}
        />
      )}
      <p className="flex items-start gap-2 rounded-md bg-info-subtle px-2.5 py-2 text-[0.8125rem] leading-[1.125rem]">
        <Info aria-hidden className="mt-px size-4 shrink-0 text-info" />
        {text.effect}
      </p>
    </FormSection>
  );
}
