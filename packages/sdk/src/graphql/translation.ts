// SPDX-License-Identifier: MIT
import { Field, InputType, ObjectType } from '@nestjs/graphql';

/**
 * One translation of a translatable field of master data, such as an article's name in English
 * (ADR 0053). Every module's translations share this one type, so it comes from the SDK.
 */
@ObjectType('Translation')
export class Translation {
  /** The translated field, such as name. */
  @Field(() => String) field!: string;
  /** The language as a BCP 47 tag, such as en or de-AT. */
  @Field(() => String) locale!: string;
  @Field(() => String) text!: string;
}

/** A translation as a command's input takes it, which the command's contract parses. */
@InputType('TranslationInput')
export class TranslationInput {
  @Field(() => String) field!: string;
  @Field(() => String) locale!: string;
  @Field(() => String) text!: string;
}
