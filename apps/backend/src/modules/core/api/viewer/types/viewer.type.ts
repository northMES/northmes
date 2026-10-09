// SPDX-License-Identifier: AGPL-3.0-or-later
import { Field, ID, ObjectType } from '@nestjs/graphql';

/** The signed-in user and what they hold at the request's plant and at its company (ADR 0010). */
@ObjectType('Viewer')
export class Viewer {
  @Field(() => ID) userId!: string;
  /** The permission keys the user holds at the plant, from roles there or at its company, sorted. */
  @Field(() => [String]) plantPermissions!: string[];
  /** The permission keys the user holds at the plant's company, sorted. */
  @Field(() => [String]) companyPermissions!: string[];
}
