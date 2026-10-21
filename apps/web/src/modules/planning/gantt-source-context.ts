// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { useShell } from '@northmes/web-sdk';
import { createContext, useContext, useMemo } from 'react';
import { useEnteredOrders } from './entered-orders-store.ts';
import { type GanttDataSource, g1DataSource } from './gantt-data.ts';
import { usePlanningRules } from './planning-rules-store.ts';

const GanttSourceContext = createContext<GanttDataSource>(g1DataSource);

/**
 * Hands the order Gantt another data source than the fixture G1, as a test does with a changed
 * snapshot; the app renders none and the screen reads the fixture.
 */
export const GanttSourceProvider = GanttSourceContext.Provider;

/**
 * The data source of the plan's pages, which loads with the plant's planning rules as saved and
 * the orders entered by hand, so a Save on the planning rules page or a created order loads the
 * plan again with them (#766, #768).
 */
export function useGanttSource(): GanttDataSource {
  const source = useContext(GanttSourceContext);
  const { plant } = useShell();
  const rules = usePlanningRules(plant);
  const entered = useEnteredOrders();
  return useMemo(
    () => ({ load: (input) => source.load({ ...input, rules, entered }) }),
    [source, rules, entered],
  );
}
