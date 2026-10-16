// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { User } from '../../user/types/user.type.ts';

/** The kind of a scope where a role is held. */
export enum ScopeKind {
  COMPANY = 'company',
  PLANT = 'plant',
}

registerEnumType(ScopeKind, {
  name: 'ScopeKind',
  description: 'The kind of a scope where a role is held.',
  valuesMap: {
    COMPANY: { description: 'A company.' },
    PLANT: { description: 'A plant of a company.' },
  },
});

/** A company or a plant, where a role is held (ADR 0007). */
@ObjectType('AccessScope', { description: 'A company or a plant, where a role is held.' })
export class AccessScope {
  @Field(() => ID, { description: "The scope id: the company's or the plant's id." })
  id!: string;
  @Field(() => ScopeKind, { description: 'Whether the scope is a company or a plant.' })
  kind!: ScopeKind;
  @Field(() => String, { description: "The company's or the plant's name." }) name!: string;
}

/**
 * A user's role at a scope (ADR 0010). The user holds every permission of the role there and at
 * every scope below it.
 */
@ObjectType('RoleAssignment', {
  description:
    'A role that a user holds at a scope. The user holds every permission of the role there and at every scope below it.',
})
export class RoleAssignment {
  @Field(() => ID, { description: "The assignment's id." }) id!: string;
  @Field(() => AccessScope, { description: 'The company or plant where the role is held.' })
  scope!: AccessScope;
  @Field(() => User, { description: 'The user who holds the role.' }) user!: User;
}
