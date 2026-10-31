// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Module } from '@nestjs/common';
import { masterDataApi } from '@northmes/sdk/master-data';
import { equipmentGroupService } from '../../core/equipment-group.service.ts';
import { equipmentGroupList } from './queries/equipment-group.list.ts';
import { EquipmentGroup } from './types/equipment-group.type.ts';

/**
 * core's surfaces for EquipmentGroup, which the master-data kit builds: its GraphQL queries and
 * mutations and its operations, which the operation runner serves (ADR 0073).
 */
@Module({
  imports: [equipmentGroupService.ServiceModule],
  providers: masterDataApi(equipmentGroupService, {
    type: () => EquipmentGroup,
    list: equipmentGroupList,
  }).providers,
})
export class EquipmentGroupModule {}
