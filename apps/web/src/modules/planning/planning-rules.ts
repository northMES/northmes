// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The planning rules of plan 07, Settings (#766): what each rule is, its values, its default and
// the ADR that records it, and how a plant's value goes over the company's. The planning rules
// page draws them, and the Gantt takes the four rules its analysis reads.
import type { PlanningRuleValues } from '@northmes/planning-domain';
import type { GanttSettings } from './gantt-data.ts';

export type { PlanningRuleValues };

export type PlanningRuleKey = keyof Required<PlanningRuleValues>;

/** The rules as saved: the company's values and each plant's own, by slug. */
export interface PlanningRuleSettings {
  readonly company: PlanningRuleValues;
  readonly plants: Readonly<Record<string, PlanningRuleValues>>;
}

/** One value of a rule that is picked from a list, with its words on the page. */
export interface PlanningRuleOption {
  readonly value: string | boolean;
  readonly label: string;
}

export interface PlanningRuleDefinition {
  readonly key: PlanningRuleKey;
  readonly label: string;
  readonly description: string;
  /** A list to pick from, or a number in unit. */
  readonly kind: 'choice' | 'number';
  readonly options?: readonly PlanningRuleOption[];
  readonly unit?: string;
  /** The recorded default; none while the product owner has not answered (ADR 0066). */
  readonly defaultValue?: string | boolean | number;
  readonly defaultText: string;
  readonly adr: string;
  /** Who still has to decide the rule: the product owner, or nobody yet named; none when proposed. */
  readonly open?: 'productOwner' | 'open';
  readonly proposed?: boolean;
}

const yesNo: readonly PlanningRuleOption[] = [
  { value: true, label: 'Yes' },
  { value: false, label: 'No' },
];

const noDefault = 'None recorded; a plant needs a value before it opens';

/** The rules in the order of plan 07, Settings. */
export const planningRuleDefinitions: readonly PlanningRuleDefinition[] = [
  {
    key: 'planningFactorSource',
    label: 'What divides run time',
    description:
      "Run time is divided by the operation's OEE target, by one factor for the plant, or by nothing. Setup time is never divided.",
    kind: 'choice',
    options: [
      { value: 'oeeTarget', label: 'OEE target of the operation' },
      { value: 'factor', label: 'One factor for the plant' },
      { value: 'none', label: 'Nothing' },
    ],
    defaultValue: 'oeeTarget',
    defaultText: 'OEE target of the operation',
    adr: 'ADR 0027',
    open: 'productOwner',
  },
  {
    key: 'planningFactor',
    label: 'Planning factor',
    description:
      'One factor for the whole plant, greater than 0 and at most 2. Used only when run time is divided by one factor for the plant.',
    kind: 'number',
    defaultText: 'None; required with one factor for the plant',
    adr: 'ADR 0027',
    open: 'open',
  },
  {
    key: 'frozenHours',
    label: 'Frozen window',
    description:
      'Elapsed hours from now. Autoplan keeps a job order that starts inside the window on its machine and in its order, and only moves it later.',
    kind: 'number',
    unit: 'h',
    defaultText: noDefault,
    adr: 'ADR 0028',
    open: 'productOwner',
  },
  {
    key: 'leadTimeBasis',
    label: 'Lead time counts',
    description:
      'Elapsed time runs through nights and weekends, as cooling does. Working time counts only the open time of the calendar.',
    kind: 'choice',
    options: [
      { value: 'elapsed', label: 'Elapsed time' },
      { value: 'working', label: 'Working time' },
    ],
    defaultValue: 'elapsed',
    defaultText: 'Elapsed time',
    adr: 'ADR 0027',
    open: 'productOwner',
  },
  {
    key: 'retoolOverlapsLeadTime',
    label: 'Setup may run during the lead time',
    description:
      "Yes: the next operation's setup may run while the lead time passes, and its first piece waits for the lead time. No: the setup starts after the lead time.",
    kind: 'choice',
    options: yesNo,
    defaultValue: true,
    defaultText: 'Yes',
    adr: 'ADR 0028',
    proposed: true,
  },
  {
    key: 'deadlineRule',
    label: 'Deadline time when the ERP sends a date only',
    description:
      'Start of day is 00:00 plant time on the deadline date. End of shift is the end of the shift on that date in the plant calendar.',
    kind: 'choice',
    options: [
      { value: 'startOfDay', label: 'Start of day, 00:00' },
      { value: 'endOfShift', label: 'End of shift' },
    ],
    defaultValue: 'startOfDay',
    defaultText: 'Start of day, 00:00',
    adr: 'ADR 0027',
    open: 'productOwner',
  },
  {
    key: 'softLockIdleExpiryMinutes',
    label: 'Lock expiry after idle time',
    description:
      'A planner who changes an order in a draft holds a lock on it. The lock ends after this much idle time, and another planner may then take the order.',
    kind: 'number',
    unit: 'min',
    defaultText: noDefault,
    adr: 'ADR 0029',
    open: 'productOwner',
  },
  {
    key: 'countPurchaseRequisitions',
    label: 'Purchase requisitions count as incoming stock',
    description:
      'Yes: purchase requisitions from the ERP count in the projected balance of the material warning. No: only purchase orders count.',
    kind: 'choice',
    options: yesNo,
    defaultText: noDefault,
    adr: 'ADR 0028',
    open: 'productOwner',
  },
];

/** A rule's value at a plant and where it comes from; both are undefined when no scope sets it. */
export interface EffectiveRule<Value> {
  readonly value: Value | undefined;
  readonly from: 'plant' | 'company' | undefined;
}

export type EffectivePlanningRules = {
  readonly [Key in PlanningRuleKey]: EffectiveRule<Required<PlanningRuleValues>[Key]>;
};

/** A plant's rules: its own value where it sets one, else the company's. */
export function effectivePlanningRules(
  settings: PlanningRuleSettings,
  plant: string,
): EffectivePlanningRules {
  const own = settings.plants[plant] ?? {};
  const entries = planningRuleDefinitions.map(({ key }) => {
    if (own[key] !== undefined) return [key, { value: own[key], from: 'plant' }] as const;
    if (settings.company[key] !== undefined) {
      return [key, { value: settings.company[key], from: 'company' }] as const;
    }
    return [key, { value: undefined, from: undefined }] as const;
  });
  return Object.fromEntries(entries) as unknown as EffectivePlanningRules;
}

/**
 * The Gantt's settings with a plant's rules in them: the four rules the Gantt's analysis reads
 * (the deadline rule, the frozen window, the lead time basis and the setup overlap). A rule no
 * scope sets keeps the base value. What divides run time does not change the mock plan: the
 * fixture's durations are fixed.
 */
export function ganttSettingsWith(
  base: GanttSettings,
  rules: EffectivePlanningRules,
): GanttSettings {
  return {
    ...base,
    ...(rules.deadlineRule.value !== undefined && { deadlineRule: rules.deadlineRule.value }),
    ...(rules.frozenHours.value !== undefined && { frozenHours: rules.frozenHours.value }),
    ...(rules.leadTimeBasis.value !== undefined && { leadTimeBasis: rules.leadTimeBasis.value }),
    ...(rules.retoolOverlapsLeadTime.value !== undefined && {
      retoolOverlapsLeadTime: rules.retoolOverlapsLeadTime.value,
    }),
  };
}
