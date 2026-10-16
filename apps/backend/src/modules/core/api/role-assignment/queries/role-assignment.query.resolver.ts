// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
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

  @Query(() => [RoleAssignment], {
    description:
      "Every role assignment at the request's plant, by the holder's name. Roles at the company are left out. Needs core.user:read at the plant.",
  })
  corePlantRoleAssignments(): Promise<RoleAssignmentRecord[]> {
    return this.assignments.atPlant();
  }
}
