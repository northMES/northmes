// SPDX-License-Identifier: AGPL-3.0-or-later
import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { User } from '../../user/types/user.type.ts';

/** The kind of a scope where a role is held. */
export enum ScopeKind {
  COMPANY = 'company',
  PLANT = 'plant',
}

registerEnumType(ScopeKind, { name: 'ScopeKind' });

/** A company or a plant, where a role is held (ADR 0007). */
@ObjectType('AccessScope')
export class AccessScope {
  /** The scope id: the company's or the plant's id. */
  @Field(() => ID) id!: string;
  @Field(() => ScopeKind) kind!: ScopeKind;
  @Field(() => String) name!: string;
}

/**
 * A user's role at a scope (ADR 0010). The user holds every permission of the role there and at
 * every scope below it.
 */
@ObjectType('RoleAssignment')
export class RoleAssignment {
  @Field(() => ID) id!: string;
  @Field(() => AccessScope) scope!: AccessScope;
  @Field(() => User) user!: User;
}
