// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { useShell } from '@northmes/web-sdk';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useState,
  useSyncExternalStore,
} from 'react';
import { emptyDraft, type GanttDraft } from './gantt-draft.ts';

/**
 * The planner's drafts, one per plant, in memory until the plan server keeps them (plan 07,
 * Drafts; ADR 0029): the board, the order Gantt and the job order table read and write the same
 * draft, so a move on one page shows on the others.
 */
export interface DraftStore {
  readonly get: (plant: string) => GanttDraft;
  readonly set: (plant: string, draft: GanttDraft) => void;
  readonly subscribe: (listener: () => void) => () => void;
}

/** A store of drafts that lives as long as the router that creates it. */
export function createDraftStore(): DraftStore {
  const drafts = new Map<string, GanttDraft>();
  const listeners = new Set<() => void>();
  return {
    get: (plant) => drafts.get(plant) ?? emptyDraft,
    set: (plant, draft) => {
      drafts.set(plant, draft);
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const DraftStoreContext = createContext<DraftStore | undefined>(undefined);

/** The planning routes' draft store, which every planning page under it shares. */
export function PlanningDraftProvider({
  store,
  children,
}: {
  readonly store: DraftStore;
  readonly children: ReactNode;
}) {
  return <DraftStoreContext.Provider value={store}>{children}</DraftStoreContext.Provider>;
}

const unsubscribed = () => () => {};

/**
 * The planner's draft at the current plant and the function that replaces it. Under the planning
 * routes every page shares one draft per plant; a page rendered without them keeps its own.
 */
export function usePlanningDraft(): readonly [GanttDraft, (draft: GanttDraft) => void] {
  const store = useContext(DraftStoreContext);
  const { plant } = useShell();
  const [local, setLocal] = useState<GanttDraft>(emptyDraft);
  const shared = useSyncExternalStore(
    store?.subscribe ?? unsubscribed,
    () => store?.get(plant) ?? emptyDraft,
  );
  // A stable setter, as useState's is, so the actions that write the draft keep their identity.
  const setShared = useCallback((draft: GanttDraft) => store?.set(plant, draft), [store, plant]);
  if (store === undefined) return [local, setLocal];
  return [shared, setShared];
}
