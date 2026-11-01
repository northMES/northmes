// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { ArgsType, Field, ID } from '@nestjs/graphql';
import { equipment } from '@northmes/core-contracts';
import { defineList } from '@northmes/sdk/lists';
import { Equipment } from '../types/equipment.type.ts';

/**
 * The list of machines that core's contracts declare: coreEquipmentList, by code unless orderBy
 * says otherwise, without the archived ones unless includeArchived asks for them (ADR 0016).
 * core.findEquipmentList reads the same declaration.
 */
export const equipmentList = defineList(equipment.list, { node: () => Equipment });

/** The arguments of coreEquipmentList: the list's, and its filter fields. */
@ArgsType()
export class EquipmentListArgs extends equipmentList.Args {
  @Field(() => ID, { nullable: true, description: 'Only the machines of this equipment group.' })
  groupId?: string | null;

  @Field(() => Boolean, {
    nullable: true,
    description: 'Only the machines whose isPlannable is this value.',
  })
  isPlannable?: boolean | null;

  @Field(() => Boolean, {
    nullable: true,
    description:
      'True for the machines the planning board shows, those plannable or OEE-measured; false for the others.',
  })
  onBoard?: boolean | null;
}
