// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject } from '@nestjs/common';
import { Context, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { loaderFor, type RequestContext } from '@northmes/sdk/graphql';
import { type RoleRecord, RoleService } from '../../../core/role.service.ts';
import type { RoleAssignmentRecord } from '../../../core/role-assignment.service.ts';
import { Role } from '../../role/types/role.type.ts';
import { RoleAssignment } from '../types/role-assignment.type.ts';

/** The fields of RoleAssignment that read further. */
@Resolver(() => RoleAssignment)
export class RoleAssignmentFieldResolver {
  constructor(@Inject(RoleService) private readonly roles: RoleService) {}

  /**
   * The role held. It needs core.role:read where the request runs: without it, the field is null
   * with FORBIDDEN and core.forbidden, so a reader of users sees no access in its place. The roles
   * of every assignment in an answer are read in one query.
   */
  @ResolveField(() => Role, { nullable: true })
  role(
    @Parent() assignment: RoleAssignmentRecord,
    @Context() context: RequestContext,
  ): Promise<RoleRecord | null> {
    const { companyId } = assignment;
    return loaderFor(context, `core.role:${companyId}`, (ids: readonly string[]) =>
      this.roles.byIds(ids, companyId),
    ).load(assignment.roleId);
  }
}
