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
   * The user's roles where the request runs, those at the company first: at a plant, at its
   * company and the plant, never at another plant; in company settings, at the company and every
   * plant of it. The roles of every user in an answer are read in one query. It needs
   * core.user:read there, and each assignment's role core.role:read.
   */
  @ResolveField(() => [RoleAssignment])
  roleAssignments(
    @Parent() user: UserRecord,
    @Context() context: RequestContext,
  ): Promise<RoleAssignmentRecord[]> {
    const { companyId } = user;
    return loaderFor(context, `core.userRoleAssignments:${companyId}`, (ids: readonly string[]) =>
      this.assignments.ofUsers(ids, companyId),
    ).load(user.id);
  }

  /**
   * What the user may do where the request runs: every installed permission, by key, with the
   * assignments that grant it, at the plant or at its company, or in company settings at the
   * company. It names roles, so it needs core.role:read there.
   */
  @ResolveField(() => [EffectivePermission])
  effectivePermissions(@Parent() user: UserRecord): Promise<EffectivePermissionRecord[]> {
    return this.assignments.effectivePermissions(user.id, user.companyId);
  }
}
