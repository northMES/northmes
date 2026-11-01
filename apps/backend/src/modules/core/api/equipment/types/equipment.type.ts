// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Field, GraphQLISODateTime, ID, Int, ObjectType } from '@nestjs/graphql';
import { Translation } from '@northmes/sdk/graphql';

/**
 * A machine of a plant, in an equipment group of the plant or of the company (ADR 0007). With
 * isPlannable or isOee it is on the planning board.
 */
@ObjectType('Equipment', {
  description:
    'Equipment of a plant, something that runs operations or is measured: usually a machine, sometimes a building, a lift or a truck. It belongs to an equipment group of the plant or of the company, and is on the planning board when it is plannable or OEE-measured.',
})
export class Equipment {
  @Field(() => ID, { description: "The machine's id." }) id!: string;
  @Field(() => String, {
    description: 'The code, unique among the machines of the plant.',
  })
  code!: string;
  @Field(() => String, { description: "The machine's name." }) name!: string;
  @Field(() => [Translation], {
    description: 'The translations of the name, in the order they were saved.',
  })
  translations!: Translation[];
  @Field(() => ID, { description: "The id of the machine's equipment group." })
  groupId!: string;
  @Field(() => Boolean, { description: 'True when planners plan job orders on the machine.' })
  isPlannable!: boolean;
  @Field(() => Boolean, { description: "True when the machine's OEE is measured." })
  isOee!: boolean;
  @Field(() => String, {
    nullable: true,
    description:
      "The machine's own palette color for its stripe, palette-1 to palette-20, or null when the stripe takes the group's color.",
  })
  color!: string | null;
  @Field(() => Int, {
    description:
      'Grows by one with every change to the machine; an update sends it as expectedVersion.',
  })
  version!: number;
  @Field(() => GraphQLISODateTime, {
    nullable: true,
    description:
      'When the machine was archived, or null while it is active. An archived machine is hidden from coreEquipmentList unless includeArchived is true, and keeps its code.',
  })
  archivedAt!: Date | null;
  @Field(() => GraphQLISODateTime, {
    description: 'When the machine last changed, its creation included.',
  })
  updatedAt!: Date;
}
