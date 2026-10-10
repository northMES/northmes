// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';
import {
  type RoleAssignmentRecord,
  RoleAssignmentService,
} from '../../../core/role-assignment.service.ts';
import { RoleAssignment } from '../types/role-assignment.type.ts';

/** core's queries on RoleAssignment. */
@Resolver(() => RoleAssignment)
export class RoleAssignmentQueryResolver {
  constructor(@Inject(RoleAssignmentService) private readonly assignments: RoleAssignmentService) {}

  /**
   * Every role assignment at the request's plant, by the holder's name: the people of the plant,
   * whom a plant admin manages in plant settings. Roles at the company are left out. It needs
   * core.user:read at the plant.
   */
  @Query(() => [RoleAssignment])
  corePlantRoleAssignments(): Promise<RoleAssignmentRecord[]> {
    return this.assignments.atPlant();
  }
}
