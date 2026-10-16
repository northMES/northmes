// SPDX-License-Identifier: MIT
import { Field, InputType, ObjectType } from '@nestjs/graphql';

/**
 * One translation of a translatable field of master data, such as an article's name in English
 * (ADR 0053). Every module's translations share this one type, so it comes from the SDK.
 */
@ObjectType('Translation', {
  description: "One translation of a translatable field, such as an article's name in English.",
})
export class Translation {
  @Field(() => String, { description: 'The translated field, such as name.' }) field!: string;
  @Field(() => String, { description: 'The language as a BCP 47 tag, such as en or de-AT.' })
  locale!: string;
  @Field(() => String, { description: 'The text in that language.' }) text!: string;
}

/** A translation as a command's input takes it, which the command's contract parses. */
@InputType('TranslationInput', {
  description: 'One translation of a translatable field, as a command takes it.',
})
export class TranslationInput {
  @Field(() => String, { description: 'The translated field, such as name.' }) field!: string;
  @Field(() => String, { description: 'The language as a BCP 47 tag, such as en or de-AT.' })
  locale!: string;
  @Field(() => String, { description: 'The text in that language.' }) text!: string;
}
