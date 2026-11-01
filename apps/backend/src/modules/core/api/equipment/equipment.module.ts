// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Module } from '@nestjs/common';
import { masterDataApi } from '@northmes/sdk/master-data';
import { equipmentService } from '../../core/equipment.service.ts';
import { equipmentGroupService } from '../../core/equipment-group.service.ts';
import { EquipmentFieldResolver } from './fields/equipment.field.resolver.ts';
import { EquipmentListArgs, equipmentList } from './queries/equipment.list.ts';
import { Equipment } from './types/equipment.type.ts';

/**
 * core's surfaces for Equipment, which the master-data kit builds: its GraphQL queries and
 * mutations and its operations, which the operation runner serves (ADR 0073), and the group field.
 */
@Module({
  imports: [equipmentService.ServiceModule, equipmentGroupService.ServiceModule],
  providers: [
    ...masterDataApi(equipmentService, {
      type: () => Equipment,
      list: equipmentList,
      args: () => EquipmentListArgs,
    }).providers,
    EquipmentFieldResolver,
  ],
})
export class EquipmentModule {}
