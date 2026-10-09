// SPDX-License-Identifier: AGPL-3.0-or-later
import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

/** Where a role comes from. */
export enum RoleOrigin {
  /** A module's default role, which northmes migrate keeps; it cannot be edited. */
  MODULE = 'module',
  /** A role the company made from module permissions. */
  CUSTOM = 'custom',
}

registerEnumType(RoleOrigin, { name: 'RoleOrigin' });

/** A named set of permissions of a company, which users hold at a scope (ADR 0010). */
@ObjectType('Role')
export class Role {
  @Field(() => ID) id!: string;
  /** Unique within the company: `<module>-<role>` for a default role. */
  @Field(() => String) key!: string;
  /** Unique within the company. */
  @Field(() => String) name!: string;
  @Field(() => RoleOrigin) origin!: RoleOrigin;
  /** The module of a default role, or null for a custom role. */
  @Field(() => String, { nullable: true }) moduleId!: string | null;
  /** The permission keys the role holds, sorted. */
  @Field(() => [String]) permissions!: string[];
  /** Grows by one with every change to the role; a change sends it as expectedVersion. */
  @Field(() => Int) version!: number;
}
