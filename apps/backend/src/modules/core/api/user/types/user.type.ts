// SPDX-License-Identifier: AGPL-3.0-or-later
import { Field, ID, ObjectType } from '@nestjs/graphql';

/**
 * A person who signs in to NorthMES, an operator too (ADR 0010). Better Auth keeps the user; core
 * reads the name, the username and whether the user is blocked.
 */
@ObjectType('User', { description: 'A person who signs in to NorthMES, an operator too.' })
export class User {
  @Field(() => ID, { description: "The user's id." }) id!: string;
  @Field(() => String, { description: 'The name others see.' }) name!: string;
  @Field(() => String, {
    description:
      'The handle lists show for the user. It never changes and is never given to anyone else.',
  })
  username!: string;
  @Field(() => Boolean, {
    description: 'A blocked user cannot sign in, and their next request is refused.',
  })
  blocked!: boolean;
}
