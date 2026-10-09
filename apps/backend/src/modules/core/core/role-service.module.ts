// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from '@nestjs/common';
import { RoleService } from './role.service.ts';
import { RoleAssignmentService } from './role-assignment.service.ts';

/** Provides core's RoleService and RoleAssignmentService: plain providers and no resolvers. */
@Module({
  providers: [RoleService, RoleAssignmentService],
  exports: [RoleService, RoleAssignmentService],
})
export class RoleServiceModule {}
