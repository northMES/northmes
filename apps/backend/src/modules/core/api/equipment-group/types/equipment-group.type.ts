// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Field, GraphQLISODateTime, ID, Int, ObjectType } from '@nestjs/graphql';
import { Translation } from '@northmes/sdk/graphql';

/**
 * A group of equipment, such as Assembly or Turning: a register at the company, which every plant
 * of it sees, or at one plant (ADR 0007). Its palette color is the planning board's group band.
 */
@ObjectType('EquipmentGroup', {
  description:
    'A group of equipment, such as Assembly or Turning, at the company or at one plant. Its color is the band the planning board shows for its equipment.',
})
export class EquipmentGroup {
  @Field(() => ID, { description: "The group's id." }) id!: string;
  @Field(() => String, {
    description: 'The code, unique among the groups of the company and the plant that see it.',
  })
  code!: string;
  @Field(() => String, { description: "The group's name." }) name!: string;
  @Field(() => [Translation], {
    description: 'The translations of the name, in the order they were saved.',
  })
  translations!: Translation[];
  @Field(() => String, {
    description:
      'Where the group sits: company, which every plant of the company sees, or plant, the plant it was created at.',
  })
  scope!: 'company' | 'plant';
  @Field(() => String, { description: 'The palette color, palette-1 to palette-20.' })
  color!: string;
  @Field(() => String, {
    description:
      'Where the color came from: erp, set by a person, or palette, the first free palette color when the group was created.',
  })
  colorFrom!: 'erp' | 'set' | 'palette';
  @Field(() => Int, {
    description:
      'Grows by one with every change to the group; an update sends it as expectedVersion.',
  })
  version!: number;
  @Field(() => GraphQLISODateTime, {
    nullable: true,
    description:
      'When the group was archived, or null while it is active. An archived group is hidden from coreEquipmentGroups unless includeArchived is true, and keeps its code.',
  })
  archivedAt!: Date | null;
  @Field(() => GraphQLISODateTime, {
    description: 'When the group last changed, its creation included.',
  })
  updatedAt!: Date;
}
