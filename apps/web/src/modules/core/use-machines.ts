// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { CoreEquipmentList, type MachineRow } from './equipment-list.graphql.ts';
import { useEveryPage } from './master-data/use-every-page.ts';

/**
 * The plant's machines by code, the active ones and with includeArchived the archived ones too,
 * every page of them. The list reads them from the network each time it opens, so a machine
 * changed on another page shows.
 */
export function useMachines(includeArchived: boolean) {
  return useEveryPage(
    CoreEquipmentList,
    'coreEquipmentList',
    { includeArchived },
    'cache-and-network',
  );
}

/** The plant's active machines as the equipment group pages show them. */
export interface PlantMachines {
  /** Every active machine of the plant, once every page is in; none while they load or failed. */
  readonly machines: readonly MachineRow[] | undefined;
  /** The machines are in, or their read failed, so the page need not wait for them. */
  readonly settled: boolean;
  /** Why the machines could not be read, such as a user without core.equipment:read. */
  readonly error: unknown;
}

/**
 * The plant's active machines for the equipment group pages, which count and list the machines in
 * each group. A user who reads groups but not machines still sees the groups: the machines are
 * then none, with the error that says why.
 */
export function usePlantMachines(): PlantMachines {
  const { data, error, pageError } = useMachines(false);
  const failure = error ?? pageError;
  const complete = data !== undefined && !data.coreEquipmentList.pageInfo.hasNextPage;
  return {
    machines:
      complete && failure === undefined
        ? data.coreEquipmentList.edges.map(({ node }) => node)
        : undefined,
    settled: complete || failure !== undefined,
    error: failure,
  };
}
