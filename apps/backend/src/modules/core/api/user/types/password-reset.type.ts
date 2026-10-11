// SPDX-License-Identifier: AGPL-3.0-or-later
import { Field, ObjectType } from '@nestjs/graphql';
import { User } from './user.type.ts';

/** A user whose password coreResetPassword reset, with the temporary password to pass on once. */
@ObjectType('PasswordReset')
export class PasswordReset {
  @Field(() => User) user!: User;
  /**
   * The user's new temporary password, which only this answer holds. The admin passes it on; it
   * cannot be shown again, and the user must choose a new password at the next sign-in.
   */
  @Field(() => String) temporaryPassword!: string;
}
