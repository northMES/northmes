// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { equipmentGroups, paletteColors } from '@northmes/core-contracts';
import { type MasterDataRecord, masterDataServer } from '@northmes/sdk/master-data';
import type { Transaction } from 'kysely';
import { EquipmentGroup } from '../api/equipment-group/types/equipment-group.type.ts';
import type { CoreDatabase } from '../infrastructure/database.ts';
import { masterDataAccess } from './access/master-data-access.ts';

/** An equipment group as core's service hands it out. */
export type EquipmentGroupRecord = MasterDataRecord<typeof equipmentGroups>;

/**
 * The first palette color that no active group the request reads uses, or palette-1 when all
 * twenty are taken (#729). Row-level security limits the read to the request's plant and company.
 */
async function firstFreeColor(tx: Transaction<CoreDatabase>, companyId: string): Promise<string> {
  const used = await tx
    .selectFrom('core.equipment_group')
    .select('color')
    .where('company_id', '=', companyId)
    .where('archived_at', 'is', null)
    .execute();
  const taken = new Set(used.map(({ color }) => color));
  return paletteColors.find((color) => !taken.has(color)) ?? 'palette-1';
}

/**
 * Core's equipment groups, built with the master-data kit (ADR 0022): a register at the company or
 * at a plant. A create without a color takes the first free palette color; a color given is set.
 */
export const equipmentGroupServer = masterDataServer(equipmentGroups, {
  table: 'core.equipment_group',
  type: () => EquipmentGroup,
  access: masterDataAccess,
  columns: { color: 'color', colorFrom: 'color_from' },
  write: {
    async create({ color }, { tx, companyId }) {
      if (color !== undefined) return { color, color_from: 'set' };
      const free = await firstFreeColor(tx as Transaction<CoreDatabase>, companyId);
      return { color: free, color_from: 'palette' };
    },
    update: ({ color }) => (color === undefined ? {} : { color, color_from: 'set' }),
  },
});

/** The equipment group service, which every surface calls. */
export const EquipmentGroupService = equipmentGroupServer.Service;
