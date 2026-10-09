// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from '@nestjs/common';
import { RoleServiceModule } from '../../core/role-service.module.ts';
import { RoleAssignmentFieldResolver } from './fields/role-assignment.field.resolver.ts';
import { AssignRole } from './mutations/assign-role.mutation.ts';
import { RemoveRoleAssignment } from './mutations/remove-role-assignment.mutation.ts';

/** core's GraphQL surface for RoleAssignment and the mutations of its commands. */
@Module({
  imports: [RoleServiceModule],
  providers: [RoleAssignmentFieldResolver, AssignRole, RemoveRoleAssignment],
})
export class RoleAssignmentModule {}
