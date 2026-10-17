// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { createContext, useContext } from 'react';
import { type GanttDataSource, g1DataSource } from './gantt-data.ts';

const GanttSourceContext = createContext<GanttDataSource>(g1DataSource);

/**
 * Hands the order Gantt another data source than the fixture G1, as a test does with a changed
 * snapshot; the app renders none and the screen reads the fixture.
 */
export const GanttSourceProvider = GanttSourceContext.Provider;

export function useGanttSource(): GanttDataSource {
  return useContext(GanttSourceContext);
}
