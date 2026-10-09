// SPDX-License-Identifier: AGPL-3.0-or-later
import { Field, ID, ObjectType } from '@nestjs/graphql';

/**
 * A person who signs in to NorthMES, an operator too (ADR 0010). Better Auth keeps the user; core
 * reads the name, the username and whether the user is blocked.
 */
@ObjectType('User')
export class User {
  @Field(() => ID) id!: string;
  /** The name others see. */
  @Field(() => String) name!: string;
  /** What the user signs in with. It never changes and is never given to anyone else. */
  @Field(() => String) username!: string;
  /** A blocked user cannot sign in, and their next request is refused. */
  @Field(() => Boolean) blocked!: boolean;
}
