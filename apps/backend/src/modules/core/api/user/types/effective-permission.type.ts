// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Field, ObjectType } from '@nestjs/graphql';
import { Permission } from '../../role/types/permission.type.ts';
import { RoleAssignment } from '../../role-assignment/types/role-assignment.type.ts';

/** What a user may do at the request's plant: one permission and the assignments that grant it. */
@ObjectType('EffectivePermission', {
  description:
    "What a user may do at the request's plant: one permission and the assignments that grant it.",
})
export class EffectivePermission {
  @Field(() => Permission, { description: 'The permission.' }) permission!: Permission;
  @Field(() => [RoleAssignment], {
    description:
      "The user's assignments at the plant or at its company whose roles hold the permission. Empty when no role of the user grants it: the user has no access.",
  })
  grantedBy!: RoleAssignment[];
}
