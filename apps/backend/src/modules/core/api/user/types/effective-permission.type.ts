// SPDX-License-Identifier: AGPL-3.0-or-later
import { Field, ObjectType } from '@nestjs/graphql';
import { Permission } from '../../role/types/permission.type.ts';
import { RoleAssignment } from '../../role-assignment/types/role-assignment.type.ts';

/** What a user may do at the request's plant: one permission and the assignments that grant it. */
@ObjectType('EffectivePermission')
export class EffectivePermission {
  @Field(() => Permission) permission!: Permission;
  /**
   * The user's assignments at the plant or at its company whose roles hold the permission. Empty
   * when no role of the user grants it: the user has no access.
   */
  @Field(() => [RoleAssignment]) grantedBy!: RoleAssignment[];
}
