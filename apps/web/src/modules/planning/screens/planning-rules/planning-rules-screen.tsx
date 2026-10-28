// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatPlantDate, formatPlantDateTime, formatPlantTime } from '@northmes/contracts/format';
import { useShell } from '@northmes/web-sdk';
import { useSearch } from '@tanstack/react-router';
import { Lock } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ErrorSummary } from '../../../../ui/components/error-summary/index.ts';
import { FormActions } from '../../../../ui/components/form-actions/index.ts';
import { FormSection } from '../../../../ui/components/form-section/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { TextareaField } from '../../../../ui/components/textarea-field/index.ts';
import { UnsavedChangesGuard } from '../../../../ui/components/unsaved-changes-guard/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { fieldId } from '../../../../ui/lib/field-id.ts';
import { Skeleton } from '../../../../ui/primitives/skeleton.tsx';
import type { GanttSnapshot } from '../../gantt-data.ts';
import {
  type EffectivePlanningRules,
  type PlanningRuleDefinition,
  type PlanningRuleKey,
  type PlanningRuleValues,
  planningRuleDefinitions,
} from '../../planning-rules.ts';
import { planningRulesSearch } from '../../planning-rules-search.ts';
import {
  type PlanningRulesChange,
  usePlanningRuleSettings,
  usePlanningRules,
  usePlanningRulesStore,
} from '../../planning-rules-store.ts';
import { usePlanningSnapshot } from '../../use-planning-snapshot.ts';
import { PlanningRuleCard, type RuleDraft } from './planning-rule-card.tsx';

type Drafts = Readonly<Record<PlanningRuleKey, RuleDraft>>;
type RuleValue = string | number | boolean;

const hour = 3_600_000;

/** A rule's value in words: an option's label, a number with its unit, or No value. */
function valueText(rule: PlanningRuleDefinition, value: RuleValue | undefined): string {
  if (value === undefined) return 'No value';
  if (rule.kind === 'choice') {
    return rule.options?.find((option) => option.value === value)?.label ?? String(value);
  }
  const shown = typeof value === 'number' ? value / (rule.scale ?? 1) : value;
  return rule.unit === undefined ? String(shown) : `${shown} ${rule.unit}`;
}

/** The value a plant takes when it does not set its own: the company's, else the recorded default. */
function inheritedValue(rule: PlanningRuleDefinition, company: PlanningRuleValues) {
  return (company[rule.key] as RuleValue | undefined) ?? rule.defaultValue;
}

/**
 * The form's start: the plant's own value where it sets one, else the company's or the recorded
 * default. A rule with neither starts on the plant's own value, which then needs one.
 */
function draftsOf(rules: EffectivePlanningRules): Drafts {
  return Object.fromEntries(
    planningRuleDefinitions.map((rule) => {
      const { value, from } = rules[rule.key];
      const shown = typeof value === 'number' ? value / (rule.scale ?? 1) : value;
      return [
        rule.key,
        {
          choice: from === 'company' || from === 'default' ? 'company' : 'own',
          text: shown === undefined ? '' : String(shown),
        },
      ];
    }),
  ) as unknown as Drafts;
}

/** An own value as typed, parsed for its rule; undefined when it does not parse or is out of range. */
function parsedValue(rule: PlanningRuleDefinition, text: string): RuleValue | undefined {
  if (rule.kind === 'choice') {
    if (text === 'true') return true;
    if (text === 'false') return false;
    return rule.options?.some((option) => String(option.value) === text) ? text : undefined;
  }
  const trimmed = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return undefined;
  const number = Number(trimmed);
  if (rule.max !== undefined && number > rule.max) return undefined;
  switch (rule.key) {
    case 'planningFactor':
      return number > 0 && number <= 2 ? number : undefined;
    case 'softLockIdleExpiry':
      return Number.isInteger(number) && number >= 1 ? number * (rule.scale ?? 1) : undefined;
    default:
      return number;
  }
}

/** What a rule needs when its own value does not parse (#766, PS4). */
const valueErrors: Partial<Record<PlanningRuleKey, string>> = {
  planningFactor: 'Enter a planning factor greater than 0 and at most 2, such as 0.8.',
  frozenHours:
    'Enter the frozen window in hours, from 0 to 720. No default is recorded, so the plant needs a value.',
  softLockIdleExpiry: 'Enter the lock expiry in whole minutes, from 1 to 1440.',
};

/**
 * The values the form stands for: the own value where it is chosen and parses, else the company's
 * or the recorded default.
 */
function formValues(drafts: Drafts, company: PlanningRuleValues) {
  const values: Partial<Record<PlanningRuleKey, RuleValue>> = {};
  for (const rule of planningRuleDefinitions) {
    const draft = drafts[rule.key];
    const value =
      draft.choice === 'own' ? parsedValue(rule, draft.text) : inheritedValue(rule, company);
    if (value !== undefined) values[rule.key] = value;
  }
  return values;
}

/** What each rule does on the G1 plan, for the values in the form (PS1). */
function effectOf(
  key: PlanningRuleKey,
  values: Partial<Record<PlanningRuleKey, RuleValue>>,
  snapshot: GanttSnapshot,
  plantName: string,
): string {
  const zone = snapshot.plant.timeZone;
  switch (key) {
    case 'planningFactorSource':
      return values.planningFactorSource === 'none'
        ? `At ${plantName} a 45 s cycle plans as 45 s. With an OEE target of 0.75 it would plan as 60 s. The mock plan's durations are fixed, so the Gantt does not change.`
        : values.planningFactorSource === 'factor'
          ? `Run time is divided by the planning factor. The mock plan's durations are fixed, so the Gantt does not change.`
          : `A 45 s cycle at an OEE target of 0.75 plans as 60 s. The mock plan's durations are fixed, so the Gantt does not change.`;
    case 'planningFactor': {
      const factor = values.planningFactor;
      return typeof factor === 'number'
        ? `A 45 s cycle plans as ${Math.round((45 / factor) * 100) / 100} s.`
        : 'A factor of 0.8 would plan a 45 s cycle as 56.25 s.';
    }
    case 'frozenHours': {
      const hours = values.frozenHours;
      if (typeof hours !== 'number') return 'Without a value autoplan cannot run at this plant.';
      if (hours === 0)
        return 'No frozen window: autoplan may move any job order that has not started.';
      return `On the Gantt the frozen window runs from now, ${formatPlantDateTime(snapshot.nowMs, zone)}, to ${formatPlantDateTime(snapshot.nowMs + hours * hour, zone)}.`;
    }
    case 'leadTimeBasis':
      return values.leadTimeBasis === 'working'
        ? 'A 1 h lead time after an operation that ends at 14:30 waits for the next open time: it ends at 06:30 the next working day. The Gantt checks each link against it.'
        : 'A 1 h lead time after an operation that ends at 14:30 ends at 15:30, also after the shift. The Gantt checks each link against it.';
    case 'retoolOverlapsLeadTime':
      return values.retoolOverlapsLeadTime === false
        ? "On the Gantt a link breaks when the next operation's setup starts before the lead time ends."
        : 'On the Gantt a link breaks when the next run starts before the lead time ends; the setup may run during the lead time.';
    case 'deadlineRule': {
      const order = snapshot.productionOrders[0];
      if (order === undefined) return 'Orders whose deadline has a date only take this time.';
      const date = formatPlantDate(order.deadlineMs, zone);
      return values.deadlineRule === 'startOfDay'
        ? `A deadline date of ${date} becomes ${date} 00:00 on the Gantt.`
        : `A deadline date of ${date} becomes ${date} ${snapshot.settings.shiftEndForDeadline}, the end of shift in calendar ${snapshot.calendar.name}, on the Gantt.`;
    }
    case 'softLockIdleExpiry': {
      const seconds = values.softLockIdleExpiry;
      return typeof seconds === 'number'
        ? `A lock taken at ${formatPlantTime(snapshot.nowMs, zone)} ends at ${formatPlantTime(snapshot.nowMs + seconds * 1000, zone)} unless the planner moves a job order of the order or extends the lock. The mock data holds no locks, so the value is kept only.`
        : 'Without a value the plant cannot open.';
    }
    case 'countPurchaseRequisitions':
      return 'The material warning names the shortfall and the movement that causes it. The mock data has no material warning yet, so the value is kept only.';
  }
}

/** The form of a loaded page: every rule, the reason and the Save bar. */
function PlanningRulesForm({
  snapshot,
  plant,
  rules,
  company,
}: {
  readonly snapshot: GanttSnapshot;
  readonly plant: string;
  readonly rules: EffectivePlanningRules;
  readonly company: PlanningRuleValues;
}) {
  const store = usePlanningRulesStore();
  const initial = useMemo(() => draftsOf(rules), [rules]);
  const [drafts, setDrafts] = useState<Drafts>(initial);
  const [savedDrafts, setSavedDrafts] = useState<Drafts>(initial);
  const [errors, setErrors] = useState<Partial<Record<PlanningRuleKey, string>>>({});
  const [submits, setSubmits] = useState(0);
  const [status, setStatus] = useState('');
  const [reason, setReason] = useState('');
  const plantName = snapshot.plants?.find((each) => each.slug === plant)?.name ?? plant;
  const values = formValues(drafts, company);
  const factorUsed = values.planningFactorSource === 'factor';
  const dirty = JSON.stringify(drafts) !== JSON.stringify(savedDrafts) || reason !== '';
  /** Whether a rule takes a value at the plant: the planning factor only with one factor. */
  const applies = (key: PlanningRuleKey) => key !== 'planningFactor' || factorUsed;
  const ownCount = planningRuleDefinitions.filter(
    (rule) => drafts[rule.key].choice === 'own' && (rule.key !== 'planningFactor' || factorUsed),
  ).length;

  const save = () => {
    const found: Partial<Record<PlanningRuleKey, string>> = {};
    const change: Record<string, RuleValue | null> = {};
    for (const rule of planningRuleDefinitions) {
      const draft = drafts[rule.key];
      if (draft.choice === 'company') {
        change[rule.key] = null;
        continue;
      }
      const value = parsedValue(rule, draft.text);
      // A rule the plant does not use keeps its own value, as the page says, when it has one.
      if (!applies(rule.key)) {
        if (value !== undefined) change[rule.key] = value;
        continue;
      }
      if (value === undefined)
        found[rule.key] = valueErrors[rule.key] ?? `Choose a value for ${rule.label}.`;
      else change[rule.key] = value;
    }
    setErrors(found);
    setSubmits((count) => count + 1);
    if (Object.keys(found).length > 0) {
      setStatus('');
      return;
    }
    store.save(plant, change as PlanningRulesChange);
    setSavedDrafts(drafts);
    setReason('');
    setStatus('Planning rules saved.');
    announce('Planning rules saved.');
  };

  // A rule that no longer takes its own value leaves the summary, so no link points to a field
  // that is gone.
  const summaryErrors = planningRuleDefinitions.flatMap((rule) => {
    const message =
      applies(rule.key) && drafts[rule.key].choice === 'own' ? errors[rule.key] : undefined;
    return message === undefined
      ? []
      : [
          {
            name: `rules.${rule.key}`,
            fieldId: fieldId(`rules.${rule.key}`),
            message: `${rule.label}: ${message}`,
          },
        ];
  });

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <UnsavedChangesGuard when={dirty} />
      <ErrorSummary
        heading={`${summaryErrors.length} ${summaryErrors.length === 1 ? 'rule needs' : 'rules need'} a change`}
        errors={summaryErrors}
        focusKey={submits}
      />
      <p className="max-w-[55rem] text-sm text-muted-foreground">
        {plantName} takes each rule from the company unless you set it here.{' '}
        {ownCount === 0
          ? 'Every rule uses the company value.'
          : `${ownCount} ${ownCount === 1 ? 'rule is' : 'rules are'} set for ${plantName}.`}{' '}
        Each default names the decision record that holds it.
      </p>
      <p className="text-xs text-muted-foreground">
        {snapshot.fixture !== undefined && `Showing fixture ${snapshot.fixture}. `}
        On mock data the Gantt reads the frozen window, the deadline time, how lead time counts and
        whether setup may run during the lead time. What divides run time, the planning factor, the
        lock expiry and purchase requisitions are kept in this browser tab and change nothing on the
        mock plan yet. A reload starts from the fixture's rules again.
      </p>
      {planningRuleDefinitions.map((rule) => {
        const companyValue = company[rule.key] as RuleValue | undefined;
        return (
          <PlanningRuleCard
            key={rule.key}
            rule={rule}
            plantName={plantName}
            companyText={valueText(rule, companyValue)}
            inheritLabel={
              companyValue !== undefined
                ? 'Use the company value'
                : rule.defaultValue !== undefined
                  ? `Use the default, ${valueText(rule, rule.defaultValue)}`
                  : 'Use the company value, none is set'
            }
            canInherit={inheritedValue(rule, company) !== undefined}
            draft={drafts[rule.key]}
            error={errors[rule.key]}
            notUsed={
              rule.key === 'planningFactor' && !factorUsed
                ? `Not used: ${plantName} divides run time by ${
                    values.planningFactorSource === 'none'
                      ? 'nothing'
                      : "the operation's OEE target"
                  }.`
                : undefined
            }
            effect={effectOf(rule.key, values, snapshot, plantName)}
            onChange={(draft) => {
              setDrafts((current) => ({ ...current, [rule.key]: draft }));
              setErrors(({ [rule.key]: _changed, ...others }) => others);
              setStatus('');
            }}
          />
        );
      })}
      <FormSection title="Reason for change">
        <TextareaField
          label="Reason"
          optional
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          hint="Shown in the history of the planning settings once it exists. Do not enter personal data. Up to 500 characters."
        />
      </FormSection>
      <p className="text-sm text-muted-foreground">{status}</p>
      <FormActions
        saveLabel="Save planning rules"
        saving={false}
        onCancel={() => {
          setDrafts(savedDrafts);
          setErrors({});
          setReason('');
          setStatus('');
        }}
        dirty={dirty}
        note="Nothing moves on the plan until autoplan runs or a planner moves a job order; the Gantt shows the new rules at once."
      />
    </form>
  );
}

/**
 * The planning rules page in plant settings (plan 07, Settings; #766, PS1 to PS7): each rule with
 * its company value, the plant's choice between it and its own value, the default with the ADR
 * that records it, whether the product owner still has to decide it, and what it does on the plan.
 * The page saves to the in-memory store that the plan's pages load with, until planning settings
 * have their API. The onboarding's planning rules step reuses the page. The URL's preview opens the
 * loading, could not load and no access states.
 */
export function PlanningRulesScreen() {
  const { plant } = useShell();
  const { preview } = planningRulesSearch(useSearch({ strict: false }));
  const { snapshot, error, retry } = usePlanningSnapshot();
  const rules = usePlanningRules(plant);
  const { company } = usePlanningRuleSettings();
  let state: PageState = { status: 'ready' };
  if (preview === 'forbidden') {
    state = {
      status: 'empty',
      icon: Lock,
      title: 'You need the permission to change planning rules at this plant',
      description:
        'Planning rules are planning settings. Ask your plant admin for a role that can change the plant settings.',
    };
  } else if (preview === 'error' || (snapshot === undefined && error !== undefined)) {
    state = {
      status: 'error',
      title: 'Could not load the planning rules',
      error: error ?? new Error('Previewed failure'),
      onRetry: retry,
    };
  } else if (preview === 'loading' || snapshot === undefined) {
    state = { status: 'loading' };
  }
  return (
    <PageFrame title="Planning rules" state={state}>
      {state.status === 'loading' && (
        <div className="grid gap-4">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
          <p className="text-sm text-muted-foreground">Loading the planning rules</p>
        </div>
      )}
      {state.status === 'ready' && snapshot !== undefined && (
        <PlanningRulesForm snapshot={snapshot} plant={plant} rules={rules} company={company} />
      )}
    </PageFrame>
  );
}
