// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { paletteColors } from '@northmes/contracts';
import { equipmentGroups } from '@northmes/core-contracts';
import { type MasterDataRecord, masterDataService } from '@northmes/sdk/master-data';
import type { Transaction } from 'kysely';
import { equipmentGroupList } from '../api/equipment-group/queries/equipment-group.list.ts';
import type { CoreDatabase } from '../infrastructure/database.ts';
import { masterDataAccess } from './access/master-data-access.ts';

/** An equipment group as core's service hands it out. */
export type EquipmentGroupRecord = MasterDataRecord<typeof equipmentGroups>;

/**
 * The first palette color that no active group the request reads uses, or palette-1 when all
 * twenty are taken (#729). Row-level security limits the read to where the request reads: at a
 * plant, the plant's groups and the company's.
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
 * at a plant. A create without a color takes the first free palette color; a new color is set.
 */
export const equipmentGroupService = masterDataService(equipmentGroups, {
  table: 'core.equipment_group',
  list: equipmentGroupList,
  access: masterDataAccess,
  columns: { color: 'color', colorFrom: 'color_from' },
  write: {
    async create({ color }, { tx, companyId }) {
      if (color !== undefined) return { color, color_from: 'set' };
      const free = await firstFreeColor(tx as Transaction<CoreDatabase>, companyId);
      return { color: free, color_from: 'palette' };
    },
    // An update that sends the color the group has, as a form does, keeps where it came from.
    update: ({ color }, { target }) =>
      color === undefined || color === target.color ? {} : { color, color_from: 'set' },
  },
});
