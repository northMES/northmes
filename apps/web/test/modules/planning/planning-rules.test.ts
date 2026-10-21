// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { g1 } from '@northmes/planning-domain';
import { describe, expect, it } from 'vitest';
import {
  effectivePlanningRules,
  ganttSettingsWith,
  planningRuleDefinitions,
} from '../../../src/modules/planning/planning-rules.ts';
import { createG1PlanningRulesStore } from '../../../src/modules/planning/planning-rules-store.ts';

describe('the planning rules of a plant over its company (plan 07, Settings; #766)', () => {
  it('lists the eight rules of plan 07 in its order, each with its default and the ADR that records it', () => {
    expect(planningRuleDefinitions.map((rule) => [rule.key, rule.adr])).toEqual([
      ['planningFactorSource', 'ADR 0027'],
      ['planningFactor', 'ADR 0027'],
      ['frozenHours', 'ADR 0028'],
      ['leadTimeBasis', 'ADR 0027'],
      ['retoolOverlapsLeadTime', 'ADR 0028'],
      ['deadlineRule', 'ADR 0027'],
      ['softLockIdleExpiryMinutes', 'ADR 0029'],
      ['countPurchaseRequisitions', 'ADR 0028'],
    ]);
    const withoutDefault = planningRuleDefinitions
      .filter((rule) => rule.defaultValue === undefined)
      .map((rule) => rule.key);
    expect(withoutDefault).toEqual([
      'planningFactor',
      'frozenHours',
      'softLockIdleExpiryMinutes',
      'countPurchaseRequisitions',
    ]);
  });

  it("takes a plant's own value, else the company's, and names where each comes from", () => {
    const store = createG1PlanningRulesStore();
    const rules = effectivePlanningRules(store.get(), 'plant-a');

    expect(rules.deadlineRule).toEqual({ value: 'endOfShift', from: 'plant' });
    expect(rules.leadTimeBasis).toEqual({ value: 'elapsed', from: 'company' });
    expect(rules.frozenHours).toEqual({ value: 24, from: 'plant' });
    expect(rules.softLockIdleExpiryMinutes).toEqual({ value: 30, from: 'company' });
    expect(rules.planningFactor).toEqual({ value: undefined, from: undefined });
  });

  it("saves a plant's value, and a null takes the company's value again", () => {
    const store = createG1PlanningRulesStore();
    store.save('plant-a', { frozenHours: 48, leadTimeBasis: 'working' });
    expect(effectivePlanningRules(store.get(), 'plant-a').frozenHours).toEqual({
      value: 48,
      from: 'plant',
    });
    expect(effectivePlanningRules(store.get(), 'plant-a').leadTimeBasis).toEqual({
      value: 'working',
      from: 'plant',
    });

    store.save('plant-a', { leadTimeBasis: null });
    expect(effectivePlanningRules(store.get(), 'plant-a').leadTimeBasis).toEqual({
      value: 'elapsed',
      from: 'company',
    });
    // Another plant of the company is untouched.
    expect(effectivePlanningRules(store.get(), 'plant-b').frozenHours).toEqual({
      value: undefined,
      from: undefined,
    });
  });

  it("puts a plant's rules into the Gantt's settings, so Plant A's rules as saved are G1's", () => {
    const store = createG1PlanningRulesStore();
    const base = { ...g1.settings, frozenHours: 0, deadlineRule: 'startOfDay' as const };
    expect(ganttSettingsWith(base, effectivePlanningRules(store.get(), 'plant-a'))).toMatchObject({
      deadlineRule: g1.settings.deadlineRule,
      frozenHours: g1.settings.frozenHours,
      leadTimeBasis: g1.settings.leadTimeBasis,
      retoolOverlapsLeadTime: g1.settings.retoolOverlapsLeadTime,
    });
  });
});
