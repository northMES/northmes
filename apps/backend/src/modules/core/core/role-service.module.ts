// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Module } from '@nestjs/common';
import { RoleService } from './role.service.ts';
import { RoleAssignmentService } from './role-assignment.service.ts';

/** Provides core's RoleService and RoleAssignmentService: plain providers and no resolvers. */
@Module({
  providers: [RoleService, RoleAssignmentService],
  exports: [RoleService, RoleAssignmentService],
})
export class RoleServiceModule {}
