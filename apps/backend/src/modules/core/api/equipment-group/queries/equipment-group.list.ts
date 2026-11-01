// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { equipmentGroups } from '@northmes/core-contracts';
import { defineList } from '@northmes/sdk/lists';
import { EquipmentGroup } from '../types/equipment-group.type.ts';

/**
 * The list of equipment groups that core's contracts declare: coreEquipmentGroups, by code unless
 * orderBy says otherwise, without the archived ones unless includeArchived asks for them (ADR 0016).
 * core.findEquipmentGroups reads the same declaration.
 */
export const equipmentGroupList = defineList(equipmentGroups.list, { node: () => EquipmentGroup });
