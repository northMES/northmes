// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from '@nestjs/common';
import { RoleServiceModule } from '../../core/role-service.module.ts';
import { RoleAssignmentFieldResolver } from './fields/role-assignment.field.resolver.ts';
import { AssignRole } from './mutations/assign-role.mutation.ts';
import { RemoveRoleAssignment } from './mutations/remove-role-assignment.mutation.ts';
import { RoleAssignmentQueryResolver } from './queries/role-assignment.query.resolver.ts';

/** core's GraphQL surface for RoleAssignment, its query and the mutations of its commands. */
@Module({
  imports: [RoleServiceModule],
  providers: [
    RoleAssignmentQueryResolver,
    RoleAssignmentFieldResolver,
    AssignRole,
    RemoveRoleAssignment,
  ],
})
export class RoleAssignmentModule {}
