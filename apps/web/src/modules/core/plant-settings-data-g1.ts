// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import {
  type GanttFixture,
  type GanttMasterDataFixture,
  type GanttPagesFixture,
  g1,
  g1MasterData,
  g1Pages,
} from '@northmes/planning-domain';
import {
  type PlantSettingsForbidden as Forbidden,
  type PlantEquipmentGroup,
  PlantSettingsForbidden,
  type PlantSettingsSnapshot,
  type PlantSettingsSource,
} from './plant-settings-data.ts';

/** An ISO instant as epoch milliseconds: the one place a snapshot's instants are parsed. */
function ms(instant: string): number {
  return Date.parse(instant);
}

/** The order id of an order number, as the planning pages' snapshot ids them. */
function orderIdOf(number: string): string {
  return `po-${number}`;
}

/**
 * The equipment groups of G1, the pages fixture and the master data fixture, each with its scope,
 * where its color came from and its source as the master data fixture details them; a group it
 * does not detail is the plant's, from the ERP with the ERP's color.
 */
function groupsOf(
  fixture: GanttFixture,
  pages: GanttPagesFixture,
  masterData: GanttMasterDataFixture,
  plantName: string,
): PlantEquipmentGroup[] {
  const details = new Map(masterData.equipmentGroups.map((detail) => [detail.code, detail]));
  const own = masterData.equipmentGroups.flatMap((detail) =>
    detail.name === undefined || detail.color === undefined
      ? []
      : [{ code: detail.code, name: detail.name, color: detail.color }],
  );
  return [...fixture.equipmentGroups, ...pages.equipmentGroups, ...own].map((group) => {
    const detail = details.get(group.code);
    return {
      code: group.code,
      name: group.name,
      color: group.color,
      scope:
        detail?.scope === 'company'
          ? { kind: 'company', name: masterData.company.name }
          : { kind: 'plant', name: plantName },
      colorFrom: detail?.colorFrom ?? 'erp',
      owner: detail?.source === 'northmes' ? 'northmes' : 'erp',
    };
  });
}

/**
 * The plant settings snapshot of the fixture G1 with the pages fixture beside it: G1's machines
 * with the owners the pages fixture names and the assembly bench it adds, the equipment groups
 * with the company group the master data fixture adds,
 * the routings, every placed job order of G1 as the committed plan, and the A1 calendar with the
 * deviations the plant admin added. The deviations stay out of the Gantt's calendar on purpose:
 * a holiday on Mon 9 Nov would move 1006.10 and break G1's expected values (F0 assumption 9).
 */
export function g1PlantSettingsSnapshot(
  fixture: GanttFixture = g1,
  pages: GanttPagesFixture = g1Pages,
  masterData: GanttMasterDataFixture = g1MasterData,
): PlantSettingsSnapshot {
  const plantName =
    pages.plants.find((plant) => plant.slug === fixture.plant.slug)?.name ?? fixture.plant.slug;
  const operationName = new Map(
    fixture.productionOrders.flatMap((order) =>
      order.operations.map((operation) => [operation.displayNumber, operation.name] as const),
    ),
  );
  return {
    fixture: fixture.id,
    plant: { ...fixture.plant, name: plantName },
    nowMs: ms(fixture.now.instant),
    erp: { name: pages.erp.connectionName, importedAtMs: ms(pages.erp.importedAt.instant) },
    equipmentGroups: groupsOf(fixture, pages, masterData, plantName),
    equipment: [
      ...fixture.equipment.map((machine) => ({
        ...machine,
        owner: pages.equipmentOwners[machine.code] ?? 'erp',
      })),
      ...pages.equipment,
    ],
    routings: pages.routings,
    jobOrders: fixture.productionOrders.flatMap((order) =>
      order.jobOrders.map((row) => ({
        id: row.id,
        displayNumber: row.productionOrderOperation,
        operationName: operationName.get(row.productionOrderOperation) ?? '',
        orderId: orderIdOf(order.number),
        orderNumber: order.number,
        article: order.article,
        equipment: row.equipment,
        setupStartMs: ms(row.setupStartAt),
        endMs: ms(row.endAt),
        quantity: row.quantity,
        status: row.status,
      })),
    ),
    calendars: [
      {
        name: fixture.calendar.name,
        effectiveFrom: pages.calendar.effectiveFrom,
        cycleWeeks: pages.calendar.cycleWeeks,
        shiftName: pages.calendar.shiftName,
        weekdays: fixture.calendar.weekdays,
        shift: fixture.calendar.shift,
        breaks: fixture.calendar.breaks,
        workingSecondsPerDay: fixture.calendar.workingSecondsPerDay,
        machines: fixture.equipment
          .filter((machine) => machine.calendar === fixture.calendar.name)
          .map((machine) => machine.code),
        deviations: pages.calendar.deviations.map((deviation, index) => ({
          id: `dev-${index + 1}`,
          kind: deviation.kind,
          startsLocal: deviation.startsLocal,
          endsLocal: deviation.endsLocal,
          ...(deviation.reason !== undefined && { reason: deviation.reason }),
          ...(deviation.equipment !== undefined && { equipment: deviation.equipment }),
          addedBy: deviation.addedBy,
          addedAtMs: ms(deviation.addedAt.instant),
        })),
      },
    ],
  };
}

/** A load that never answers: the loading state of a page while it waits for the server (MA5, MF1). */
const never = new Promise<PlantSettingsSnapshot>(() => {});

/**
 * The mock data source of the plant settings pages (design #688): every load answers with the
 * fixture G1 and the pages fixture, or with the page state the URL's preview asks for, so the
 * product owner opens the loading, empty, failed and no-access states on mock data. The pages show
 * "Showing fixture G1" while it is in use.
 */
export const g1PlantSettingsSource: PlantSettingsSource = {
  load: async ({ preview }) => {
    switch (preview) {
      case 'loading':
        return never;
      case 'empty':
        return { ...g1PlantSettingsSnapshot(), equipmentGroups: [], equipment: [], jobOrders: [] };
      case 'error':
        throw new Error('The plant settings could not be loaded');
      case 'forbidden':
        throw new PlantSettingsForbidden() as Forbidden;
      default:
        return g1PlantSettingsSnapshot();
    }
  },
};
