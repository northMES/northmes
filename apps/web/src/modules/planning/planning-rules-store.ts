// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The planning rules as saved, in memory (#766): the company's values and each plant's own from
// the G1 pages fixture, and what the planning rules page saves. The Gantt, the job orders and the
// order pages load their plan with a plant's rules, so a Save shows on the plan at once. The
// planning settings API replaces the memory when it exists; the shapes are plan 07's.
import { g1Pages } from '@northmes/planning-domain';
import { createContext, useContext, useMemo, useSyncExternalStore } from 'react';
import {
  type EffectivePlanningRules,
  effectivePlanningRules,
  type PlanningRuleKey,
  type PlanningRuleSettings,
  type PlanningRuleValues,
} from './planning-rules.ts';

/** One plant's change: a value to set, or null to take the company's value again. */
export type PlanningRulesChange = {
  readonly [Key in PlanningRuleKey]?: Required<PlanningRuleValues>[Key] | null;
};

export interface PlanningRulesStore {
  readonly get: () => PlanningRuleSettings;
  readonly subscribe: (listener: () => void) => () => void;
  /** Saves a plant's values; a rule left out keeps what it was. */
  readonly save: (plant: string, change: PlanningRulesChange) => void;
}

export function createPlanningRulesStore(initial: PlanningRuleSettings): PlanningRulesStore {
  let settings = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => settings,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    save: (plant, change) => {
      const own: Record<string, unknown> = { ...settings.plants[plant] };
      for (const [key, value] of Object.entries(change)) {
        if (value === null) delete own[key];
        else if (value !== undefined) own[key] = value;
      }
      settings = {
        ...settings,
        plants: { ...settings.plants, [plant]: own as PlanningRuleValues },
      };
      for (const listener of listeners) listener();
    },
  };
}

/** A store with the company's rules and Plant A's own from the G1 pages fixture. */
export function createG1PlanningRulesStore(): PlanningRulesStore {
  return createPlanningRulesStore(g1Pages.planningRules);
}

const PlanningRulesStoreContext = createContext<PlanningRulesStore>(createG1PlanningRulesStore());

/**
 * Hands the planning rules page and the plan's pages another store than the app's, as a test does
 * with saved rules; the app renders none and every page shares the one store.
 */
export const PlanningRulesStoreProvider = PlanningRulesStoreContext.Provider;

export function usePlanningRulesStore(): PlanningRulesStore {
  return useContext(PlanningRulesStoreContext);
}

/** The planning rules as saved, kept current when a page saves. */
export function usePlanningRuleSettings(): PlanningRuleSettings {
  const store = usePlanningRulesStore();
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/** A plant's rules over its company's, kept current when a page saves. */
export function usePlanningRules(plant: string): EffectivePlanningRules {
  const settings = usePlanningRuleSettings();
  return useMemo(() => effectivePlanningRules(settings, plant), [settings, plant]);
}
