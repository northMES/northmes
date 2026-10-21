// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Info } from 'lucide-react';
import { useId } from 'react';
import { FormSection } from '../../../../ui/components/form-section/index.ts';
import { SelectField } from '../../../../ui/components/select-field/index.ts';
import { TextField } from '../../../../ui/components/text-field/index.ts';
import { Label } from '../../../../ui/primitives/label.tsx';
import { RadioGroup, RadioGroupItem } from '../../../../ui/primitives/radio-group.tsx';
import type { PlanningRuleDefinition } from '../../planning-rules.ts';

/** The decision records of the rules' defaults, by the name the page shows. */
const adrFiles: Readonly<Record<string, string>> = {
  'ADR 0027': '0027-planned-duration-formula-and-override-precedence.md',
  'ADR 0028': '0028-autoplan-as-a-pure-deterministic-function.md',
  'ADR 0029': '0029-per-planner-drafts-soft-locks-and-the-plan-revision.md',
};

/** One rule as the form holds it: the company value, or the plant's own value as typed. */
export interface RuleDraft {
  readonly choice: 'company' | 'own';
  /** The own value as text: a number as typed, or an option's value. */
  readonly text: string;
}

/**
 * One planning rule as a setting card (#766, PS1): its name, key, what it does, its default with
 * the ADR that records it and whether it is still open; the company value; the plant's choice
 * between the company value and its own; and what the rule does on the plan. A rule that does not
 * apply, such as the planning factor without one factor for the plant, says why instead.
 */
export function PlanningRuleCard({
  rule,
  plantName,
  companyText,
  inheritLabel,
  canInherit,
  draft,
  error,
  notUsed,
  effect,
  onChange,
}: {
  readonly rule: PlanningRuleDefinition;
  readonly plantName: string;
  readonly companyText: string;
  /** The words of the choice that takes no own value: the company value, or the recorded default. */
  readonly inheritLabel: string;
  /** Whether that choice has a value to take; without one the plant needs its own. */
  readonly canInherit: boolean;
  readonly draft: RuleDraft;
  readonly error: string | undefined;
  /** Why the rule does not apply at the plant; it then has no choice. */
  readonly notUsed: string | undefined;
  readonly effect: string;
  readonly onChange: (draft: RuleDraft) => void;
}) {
  const baseId = useId();
  const legendId = `${baseId}-plant`;
  const label = `${rule.label} at ${plantName}${rule.unit === undefined ? '' : `, in ${rule.unit}`}`;
  const adrFile = adrFiles[rule.adr];
  return (
    <FormSection title={rule.label} description={rule.description}>
      <div className="grid gap-x-6 gap-y-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <code className="font-mono text-xs text-muted-foreground">{rule.key}</code>
            {rule.open === 'productOwner' && (
              <span className="rounded-full bg-warning-subtle px-2 text-[0.6875rem] font-semibold leading-5 text-warning">
                Open with the product owner
              </span>
            )}
            {rule.open === 'open' && (
              <span className="rounded-full bg-warning-subtle px-2 text-[0.6875rem] font-semibold leading-5 text-warning">
                Open
              </span>
            )}
            {rule.proposed === true && (
              <span className="rounded-full bg-info-subtle px-2 text-[0.6875rem] font-semibold leading-5 text-info">
                Proposed
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Default: <span className="font-medium text-foreground">{rule.defaultText}</span>.
            Recorded in{' '}
            {adrFile === undefined ? (
              rule.adr
            ) : (
              <a
                className="text-link underline underline-offset-2 hover:no-underline"
                href={`https://github.com/northMES/northmes/blob/main/docs/adr/${adrFile}`}
              >
                {rule.adr}
              </a>
            )}
            .
          </p>
          <div className="mt-1 grid gap-0.5 rounded-md bg-muted px-2.5 py-2">
            <span className="text-xs text-muted-foreground">Company value</span>
            <b className="font-medium">{companyText}</b>
          </div>
        </div>
        {notUsed !== undefined ? (
          <div className="grid content-start gap-0.5 rounded-md bg-muted px-2.5 py-2">
            <span className="text-xs text-muted-foreground">{plantName} value</span>
            <span>{notUsed}</span>
          </div>
        ) : (
          <fieldset aria-labelledby={legendId} className="grid content-start gap-2">
            <p id={legendId} className="text-xs text-muted-foreground">
              {plantName} value
            </p>
            <RadioGroup
              aria-labelledby={legendId}
              value={draft.choice}
              onValueChange={(next) =>
                onChange({ ...draft, choice: next === 'company' ? 'company' : 'own' })
              }
              className="grid gap-2"
            >
              <div className="flex items-center gap-2 text-sm">
                <RadioGroupItem id={`${baseId}-company`} value="company" disabled={!canInherit} />
                <Label htmlFor={`${baseId}-company`} className="font-normal">
                  {inheritLabel}
                </Label>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <RadioGroupItem id={`${baseId}-own`} value="own" />
                <Label htmlFor={`${baseId}-own`} className="font-normal">
                  Set for {plantName}
                </Label>
              </div>
            </RadioGroup>
            {draft.choice === 'own' &&
              (rule.kind === 'choice' ? (
                <SelectField
                  label={label}
                  name={`rules.${rule.key}`}
                  value={draft.text}
                  error={error}
                  {...(draft.text === '' && { placeholder: 'Choose a value' })}
                  options={(rule.options ?? []).map((option) => ({
                    value: String(option.value),
                    label: option.label,
                  }))}
                  onChange={(event) => onChange({ ...draft, text: event.target.value })}
                />
              ) : (
                <TextField
                  label={label}
                  name={`rules.${rule.key}`}
                  inputMode="decimal"
                  value={draft.text}
                  error={error}
                  onChange={(event) => onChange({ ...draft, text: event.target.value })}
                />
              ))}
          </fieldset>
        )}
      </div>
      <p className="flex items-start gap-2 rounded-md bg-info-subtle px-2.5 py-2 text-[0.8125rem] leading-[1.125rem]">
        <Info aria-hidden className="mt-px size-4 shrink-0 text-info" />
        {effect}
      </p>
    </FormSection>
  );
}
