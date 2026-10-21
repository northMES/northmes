// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The orders entered by hand, in memory (#768), as the planning rules store keeps the rules. The
// plan's pages load with them, so a created order shows in the lists and on the Gantt at once.
import { createContext, useContext, useSyncExternalStore } from 'react';
import {
  type EnteredCustomerOrder,
  type EnteredOrders,
  type EnteredProductionOrder,
  nextProductionOrderNumber,
  noEnteredOrders,
} from './entered-orders.ts';

export interface EnteredOrdersStore {
  readonly get: () => EnteredOrders;
  readonly subscribe: (listener: () => void) => () => void;
  readonly addProductionOrder: (order: EnteredProductionOrder) => void;
  readonly addCustomerOrder: (order: EnteredCustomerOrder) => void;
  /** The number New production order offers next, N-1007 first. */
  readonly nextProductionOrderNumber: () => string;
}

export function createEnteredOrdersStore(
  initial: EnteredOrders = noEnteredOrders,
): EnteredOrdersStore {
  let entered = initial;
  const listeners = new Set<() => void>();
  const changed = (next: EnteredOrders) => {
    entered = next;
    for (const listener of listeners) listener();
  };
  return {
    get: () => entered,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    addProductionOrder: (order) =>
      changed({ ...entered, productionOrders: [...entered.productionOrders, order] }),
    addCustomerOrder: (order) =>
      changed({ ...entered, customerOrders: [...entered.customerOrders, order] }),
    nextProductionOrderNumber: () => nextProductionOrderNumber(entered),
  };
}

const EnteredOrdersStoreContext = createContext<EnteredOrdersStore>(createEnteredOrdersStore());

/**
 * Hands the order forms and the plan's pages another store than the app's, as a test does; the
 * app renders none and every page shares the one store.
 */
export const EnteredOrdersStoreProvider = EnteredOrdersStoreContext.Provider;

export function useEnteredOrdersStore(): EnteredOrdersStore {
  return useContext(EnteredOrdersStoreContext);
}

/** The orders entered by hand, kept current when a form creates one. */
export function useEnteredOrders(): EnteredOrders {
  const store = useEnteredOrdersStore();
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
