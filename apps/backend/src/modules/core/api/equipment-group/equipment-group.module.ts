// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Module } from '@nestjs/common';
import { equipmentGroupServer } from '../../core/equipment-group.service.ts';

/**
 * core's surfaces for EquipmentGroup, which the master-data kit builds: its GraphQL queries and
 * mutations and its operations, which the operation runner serves (ADR 0073).
 */
@Module({
  imports: [equipmentGroupServer.ServiceModule],
  providers: equipmentGroupServer.providers,
})
export class EquipmentGroupModule {}
