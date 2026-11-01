// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Inject } from '@nestjs/common';
import { Context, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { loaderFor, type RequestContext } from '@northmes/sdk/graphql';
import type { EquipmentRecord } from '../../../core/equipment.service.ts';
import {
  type EquipmentGroupRecord,
  equipmentGroupService,
} from '../../../core/equipment-group.service.ts';
import { EquipmentGroup } from '../../equipment-group/types/equipment-group.type.ts';
import { Equipment } from '../types/equipment.type.ts';

type EquipmentGroups = InstanceType<typeof equipmentGroupService.Service>;

/** The fields of Equipment that read another entity. */
@Resolver(() => Equipment)
export class EquipmentFieldResolver {
  constructor(@Inject(equipmentGroupService.Service) private readonly groups: EquipmentGroups) {}

  /**
   * The request's core.equipmentGroup loader reads the groups of every machine in a list with one
   * query, after the machine's own read check.
   */
  @ResolveField(() => EquipmentGroup, {
    nullable: true,
    description:
      "The machine's equipment group, also an archived one, or null where the request cannot read it.",
  })
  group(
    @Parent() machine: EquipmentRecord,
    @Context() context: RequestContext,
  ): Promise<EquipmentGroupRecord | null> {
    return loaderFor(context, 'core.equipmentGroup', (ids: readonly string[]) =>
      this.groups.byIds(ids),
    ).load(machine.groupId);
  }
}
