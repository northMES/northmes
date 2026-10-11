// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject } from '@nestjs/common';
import { Context, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { loaderFor, type RequestContext } from '@northmes/sdk/graphql';
import type { RoleRecord } from '../../../core/role.service.ts';
import {
  type RoleAssignmentRecord,
  RoleAssignmentService,
} from '../../../core/role-assignment.service.ts';
import { RoleAssignment } from '../../role-assignment/types/role-assignment.type.ts';
import { Role } from '../types/role.type.ts';

/** The fields of Role that read further. */
@Resolver(() => Role)
export class RoleFieldResolver {
  constructor(@Inject(RoleAssignmentService) private readonly assignments: RoleAssignmentService) {}

  /**
   * Who holds the role where the request runs, those at the company first, then by name: at a
   * plant, at its company and the plant, never at another plant; in company settings, at the
   * company and every plant of it. The holders of every role in an answer are read in one query.
   */
  @ResolveField(() => [RoleAssignment])
  holders(
    @Parent() role: RoleRecord,
    @Context() context: RequestContext,
  ): Promise<RoleAssignmentRecord[]> {
    const { companyId } = role;
    return loaderFor(context, `core.roleHolders:${companyId}`, (ids: readonly string[]) =>
      this.assignments.holdersOf(ids, companyId),
    ).load(role.id);
  }
}
