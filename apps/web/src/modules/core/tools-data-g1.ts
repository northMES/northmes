// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import {
  type GanttMasterDataFixture,
  type GanttPagesFixture,
  g1,
  g1MasterData,
  g1Pages,
} from '@northmes/planning-domain';
import type { RoutingsSnapshot } from './routings-data.ts';
import { g1RoutingsSnapshot } from './routings-data-g1.ts';
import { ToolsForbidden, type ToolsSnapshot, type ToolsSource } from './tools-data.ts';

/**
 * The tools of the fixture G1: the master data fixture's tools, each at its company or plant, with
 * the routing operations of G1's routings that allow it. G1's job orders carry no tool, so no tool
 * has job orders this week.
 */
export function g1ToolsSnapshot(
  routings: RoutingsSnapshot = g1RoutingsSnapshot(),
  masterData: GanttMasterDataFixture = g1MasterData,
  pages: GanttPagesFixture = g1Pages,
  nowMs: number = Date.parse(g1.now.instant),
): ToolsSnapshot {
  const plantName = (slug: string) =>
    pages.plants.find((plant) => plant.slug === slug)?.name ?? slug;
  return {
    ...(routings.fixture !== undefined && { fixture: routings.fixture }),
    companyName: masterData.company.name,
    plant: routings.plant,
    plants: pages.plants.map(({ slug, name }) => ({ slug, name })),
    nowMs,
    importedAtMs: Date.parse(pages.erp.importedAt.instant),
    tools: masterData.tools.map((tool) => ({
      code: tool.code,
      name: tool.name,
      scope:
        tool.plant === null
          ? { kind: 'company', name: masterData.company.name }
          : { kind: 'plant', name: plantName(tool.plant), plant: tool.plant },
      source: tool.source,
      importedAtMs: Date.parse(tool.importedAt.instant),
      jobOrders: [],
      uses: routings.routings.flatMap((routing) =>
        routing.operations.flatMap((operation) => {
          const use = operation.tools.find((each) => each.code === tool.code);
          if (use === undefined) return [];
          return [
            {
              articleNumber: routing.articleNumber,
              articleName: routing.articleName,
              sequence: operation.sequence,
              operationName: operation.name,
              ...(use.piecesPerCycle !== undefined && { piecesPerCycle: use.piecesPerCycle }),
              operationPiecesPerCycle: operation.piecesPerCycle,
              machines: operation.machines.map(({ name, default: isDefault }) => ({
                name,
                default: isDefault,
              })),
              openOrders: routing.openOrders.map((order) => order.number),
            },
          ];
        }),
      ),
    })),
  };
}

/** A load that never answers: the loading state while a page waits for the server (TO5). */
const never = new Promise<ToolsSnapshot>(() => {});

/**
 * The mock data source of the tools pages (design #729): the fixture, or the page state the
 * URL's preview asks for, so the product owner opens TO5 to TO8 on mock data.
 */
export const g1ToolsSource: ToolsSource = {
  load: async ({ preview }) => {
    switch (preview) {
      case 'loading':
        return never;
      case 'empty':
        return { ...g1ToolsSnapshot(), tools: [] };
      case 'error':
        throw new Error('The tools could not be loaded');
      case 'forbidden':
        throw new ToolsForbidden();
      default:
        return g1ToolsSnapshot();
    }
  },
};
