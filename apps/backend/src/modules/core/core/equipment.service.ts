// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { HttpStatus } from '@nestjs/common';
import { equipment } from '@northmes/core-contracts';
import { DomainError } from '@northmes/sdk/errors';
import { type MasterDataRecord, masterDataService } from '@northmes/sdk/master-data';
import type { Transaction } from 'kysely';
import { equipmentList } from '../api/equipment/queries/equipment.list.ts';
import type { CoreDatabase } from '../infrastructure/database.ts';
import { masterDataAccess } from './access/master-data-access.ts';

/** A machine as core's service hands it out. */
export type EquipmentRecord = MasterDataRecord<typeof equipment>;

/** A refusal of the group a machine names, on groupId. */
function groupRefused(code: string, message: string): DomainError {
  return new DomainError({
    code,
    status: HttpStatus.BAD_REQUEST,
    message,
    fieldErrors: [{ path: ['groupId'], message, code }],
  });
}

/**
 * Checks the group a machine at `scopeId` names (ADR 0009): a group of the machine's plant or of
 * its company, which is not archived. A group the request cannot read answers as one of another
 * plant does, so the refusal tells nothing of where it is.
 */
async function checkGroup(
  tx: Transaction<CoreDatabase>,
  groupId: string,
  { companyId, scopeId }: { readonly companyId: string; readonly scopeId: string },
): Promise<void> {
  const group = await tx
    .selectFrom('core.equipment_group')
    .select(['scope_id', 'archived_at'])
    .where('id', '=', groupId)
    .where('company_id', '=', companyId)
    .executeTakeFirst();
  if (!group || (group.scope_id !== scopeId && group.scope_id !== companyId)) {
    throw groupRefused(
      'core.crossScopeReference',
      "Choose an equipment group of the machine's plant or of the company.",
    );
  }
  if (group.archived_at !== null) {
    throw groupRefused(
      'core.archived',
      'The equipment group is archived. Choose an active group, or restore this one first.',
    );
  }
}

/**
 * Core's machines, built with the master-data kit (ADR 0022): a register at plant scope only. A
 * machine names a group of its plant or of the company; it keeps a group that was archived after,
 * but a create or a change of group takes only an active one.
 */
export const equipmentService = masterDataService(equipment, {
  table: 'core.equipment',
  list: equipmentList,
  access: masterDataAccess,
  columns: {
    groupId: 'equipment_group_id',
    isPlannable: 'is_plannable',
    isOee: 'is_oee',
    color: 'color',
  },
  write: {
    async create({ groupId, isPlannable, isOee, color }, { tx, companyId, scopeId }) {
      await checkGroup(tx as Transaction<CoreDatabase>, groupId, { companyId, scopeId });
      return {
        equipment_group_id: groupId,
        ...(isPlannable === undefined ? {} : { is_plannable: isPlannable }),
        ...(isOee === undefined ? {} : { is_oee: isOee }),
        color: color === undefined || color === 'group' ? null : color,
      };
    },
    async update({ groupId, isPlannable, isOee, color }, { tx, target }) {
      if (groupId !== target.equipment_group_id) {
        await checkGroup(tx as Transaction<CoreDatabase>, groupId, {
          companyId: target.company_id,
          scopeId: target.scope_id,
        });
      }
      return {
        equipment_group_id: groupId,
        ...(isPlannable === undefined ? {} : { is_plannable: isPlannable }),
        ...(isOee === undefined ? {} : { is_oee: isOee }),
        ...(color === undefined ? {} : { color: color === 'group' ? null : color }),
      };
    },
  },
  filter(query, { groupId, isPlannable, onBoard }) {
    let rows = query;
    if (groupId !== undefined) rows = rows.where('equipment_group_id', '=', groupId);
    if (isPlannable !== undefined) rows = rows.where('is_plannable', '=', isPlannable);
    if (onBoard !== undefined) {
      rows = rows.where((row) =>
        onBoard
          ? row.or([row('is_plannable', '=', true), row('is_oee', '=', true)])
          : row.and([row('is_plannable', '=', false), row('is_oee', '=', false)]),
      );
    }
    return rows;
  },
});
