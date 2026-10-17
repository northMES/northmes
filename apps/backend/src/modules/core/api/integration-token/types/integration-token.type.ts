// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Field, GraphQLISODateTime, ID, Int, ObjectType } from '@nestjs/graphql';
import { Role } from '../../role/types/role.type.ts';
import { AccessScope } from '../../role-assignment/types/role-assignment.type.ts';
import { User } from '../../user/types/user.type.ts';

/**
 * A credential that an outside system calls the public API with (ADR 0073). It acts as itself,
 * with its roles at the company or at one plant, never as the person who created it. Its secret
 * is shown once, when it is created, and is no field of this type.
 */
@ObjectType('IntegrationToken', {
  description:
    'A credential that an outside system calls the public API with. It acts as itself, with its roles at the company or at one plant. Its secret is shown once, when it is created.',
})
export class IntegrationToken {
  @Field(() => ID, { description: "The token's id." }) id!: string;
  @Field(() => String, { description: "The token's name, such as the system that uses it." })
  name!: string;
  @Field(() => Int, {
    description:
      'Grows by one with every change to the token; a revoke sends it as expectedVersion.',
  })
  version!: number;
  @Field(() => AccessScope, {
    description: 'The company or the plant where the token holds its roles.',
  })
  scope!: AccessScope;
  @Field(() => [Role], { description: 'The roles the token holds at its scope, by name.' })
  roles!: Role[];
  @Field(() => User, { description: 'The user who created the token.' }) createdBy!: User;
  @Field(() => GraphQLISODateTime, { description: 'When the token was created.' })
  createdAt!: Date;
  @Field(() => GraphQLISODateTime, { description: 'When the token expires.' }) expiresAt!: Date;
  @Field(() => GraphQLISODateTime, {
    nullable: true,
    description: 'When the token was revoked, or null while it is not.',
  })
  revokedAt!: Date | null;
  @Field(() => GraphQLISODateTime, {
    nullable: true,
    description: 'When the token was last used, to the minute, or null when it never was.',
  })
  lastUsedAt!: Date | null;
}
