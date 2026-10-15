// SPDX-License-Identifier: AGPL-3.0-or-later
import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

/** Where a role comes from. */
export enum RoleOrigin {
  /** A module's default role, which northmes migrate keeps; it cannot be edited. */
  MODULE = 'module',
  /** A role the company made from module permissions. */
  CUSTOM = 'custom',
}

registerEnumType(RoleOrigin, {
  name: 'RoleOrigin',
  description: 'Where a role comes from.',
  valuesMap: {
    MODULE: { description: "A module's default role, which cannot be edited." },
    CUSTOM: { description: 'A role the company made from module permissions.' },
  },
});

/** A named set of permissions of a company, which users hold at a scope (ADR 0010). */
@ObjectType('Role', {
  description: 'A named set of permissions of a company, which users hold at a scope.',
})
export class Role {
  @Field(() => ID, { description: "The role's id." }) id!: string;
  @Field(() => String, {
    description: 'The key, unique within the company: <module>-<role> for a default role.',
  })
  key!: string;
  @Field(() => String, { description: "The role's name, unique within the company." })
  name!: string;
  @Field(() => RoleOrigin, { description: 'Where the role comes from.' }) origin!: RoleOrigin;
  @Field(() => String, {
    nullable: true,
    description: 'The module of a default role, or null for a custom role.',
  })
  moduleId!: string | null;
  @Field(() => [String], { description: 'The permission keys the role holds, sorted.' })
  permissions!: string[];
  @Field(() => Int, {
    description:
      'Grows by one with every change to the role; a change sends it as expectedVersion.',
  })
  version!: number;
}
