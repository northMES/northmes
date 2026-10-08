// SPDX-License-Identifier: AGPL-3.0-or-later
import { Field, ID, ObjectType } from '@nestjs/graphql';

/**
 * Something the company makes or consumes, identified by its article number (GLOSSARY.md). Core
 * owns the type; another module returns it from a field of its own through core's API.
 */
@ObjectType('Article')
export class Article {
  @Field(() => ID) id!: string;
  @Field(() => String) code!: string;
  @Field(() => String) name!: string;
}
