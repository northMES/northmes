// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The board fields as saved, in memory (#762): the company's lists from the G1 pages fixture and
// each plant's own lists once it sets them on the board fields page. The board and the order Gantt
// read the same store, so a Save shows on their blocks and hover cards at once. The planning
// settings API replaces the memory when it exists; the shapes are plan 07's.
import { g1Pages } from '@northmes/planning-domain';
import { createContext, useContext, useMemo, useSyncExternalStore } from 'react';
import {
  type BoardFieldLists,
  type BoardFieldSettings,
  effectiveBoardFields,
} from './board-fields.ts';

/** One plant's change: a list to set, or null to use the company's list again. */
export interface BoardFieldsChange {
  readonly block?: readonly string[] | null;
  readonly hover?: readonly string[] | null;
}

export interface BoardFieldsStore {
  readonly get: () => BoardFieldSettings;
  readonly subscribe: (listener: () => void) => () => void;
  /** Saves a plant's lists; a list left out keeps what it was. */
  readonly save: (plant: string, change: BoardFieldsChange) => void;
}

export function createBoardFieldsStore(initial: BoardFieldSettings): BoardFieldsStore {
  let settings = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => settings,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    save: (plant, change) => {
      const own = { ...settings.plants[plant] };
      for (const key of ['block', 'hover'] as const) {
        const list = change[key];
        if (list === null) delete own[key];
        else if (list !== undefined) own[key] = list;
      }
      settings = { ...settings, plants: { ...settings.plants, [plant]: own } };
      for (const listener of listeners) listener();
    },
  };
}

/** A store with the company's lists of the G1 pages fixture and no plant lists yet. */
export function createG1BoardFieldsStore(): BoardFieldsStore {
  return createBoardFieldsStore({ company: g1Pages.boardFields.company, plants: {} });
}

const BoardFieldsStoreContext = createContext<BoardFieldsStore>(createG1BoardFieldsStore());

/**
 * Hands the board fields page, the board and the Gantt another store than the app's, as a test
 * does with saved lists; the app renders none and every page shares the one store.
 */
export const BoardFieldsStoreProvider = BoardFieldsStoreContext.Provider;

export function useBoardFieldsStore(): BoardFieldsStore {
  return useContext(BoardFieldsStoreContext);
}

/** The board field settings as saved, kept current when a page saves. */
export function useBoardFieldSettings(): BoardFieldSettings {
  const store = useBoardFieldsStore();
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/** The lists a plant shows on its blocks and hover cards, kept current when a page saves. */
export function useBoardFields(plant: string): BoardFieldLists {
  const settings = useBoardFieldSettings();
  return useMemo(() => effectiveBoardFields(settings, plant), [settings, plant]);
}
