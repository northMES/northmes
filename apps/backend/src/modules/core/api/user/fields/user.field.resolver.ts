// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject } from '@nestjs/common';
import { Context, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { loaderFor, type RequestContext } from '@northmes/sdk/graphql';
import {
  type EffectivePermissionRecord,
  type RoleAssignmentRecord,
  RoleAssignmentService,
} from '../../../core/role-assignment.service.ts';
import type { UserRecord } from '../../../core/user.service.ts';
import { RoleAssignment } from '../../role-assignment/types/role-assignment.type.ts';
import { EffectivePermission } from '../types/effective-permission.type.ts';
import { User } from '../types/user.type.ts';

/** The fields of User that read the user's access. */
@Resolver(() => User)
export class UserFieldResolver {
  constructor(@Inject(RoleAssignmentService) private readonly assignments: RoleAssignmentService) {}

  /**
   * The user's roles at the company of the request's plant and at the plant, those at the company
   * first; never those at another plant. The roles of every user in an answer are read in one
   * query. It needs core.user:read at the plant, and each assignment's role core.role:read.
   */
  @ResolveField(() => [RoleAssignment])
  roleAssignments(
    @Parent() user: UserRecord,
    @Context() context: RequestContext,
  ): Promise<RoleAssignmentRecord[]> {
    return loaderFor(context, 'core.userRoleAssignments', (ids: readonly string[]) =>
      this.assignments.ofUsers(ids),
    ).load(user.id);
  }

  /**
   * What the user may do at the request's plant: every installed permission, by key, with the
   * assignments at the plant or at its company that grant it. It names roles, so it needs
   * core.role:read at the plant.
   */
  @ResolveField(() => [EffectivePermission])
  effectivePermissions(@Parent() user: UserRecord): Promise<EffectivePermissionRecord[]> {
    return this.assignments.effectivePermissions(user.id);
  }
}
