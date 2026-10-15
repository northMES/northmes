// SPDX-License-Identifier: AGPL-3.0-or-later
import { Field, ObjectType } from '@nestjs/graphql';
import { User } from './user.type.ts';

/** A user that coreCreateUser created, with the temporary password to pass on once. */
@ObjectType('CreatedUser', {
  description: 'A user that coreCreateUser created, with the temporary password to pass on once.',
})
export class CreatedUser {
  @Field(() => User, { description: 'The new user.' }) user!: User;
  @Field(() => String, {
    description:
      "The user's first password, which only this answer holds. The admin passes it on; it cannot be shown again.",
  })
  temporaryPassword!: string;
}
