// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { defineMasterData, paletteColor, paletteColors } from '@northmes/contracts';
import { z } from 'zod';

/**
 * Equipment, the machines of a plant: a register at plant scope only (ADR 0007), whose codes are
 * unique within the plant and the company (ADR 0009). Each machine belongs to an equipment group of
 * its plant or of the company, and carries the IsPlannable and IsOee flags: equipment with either
 * is on the planning board. Its color stripe is the group's color unless it has its own. Plant
 * admin changes the plant's machines.
 */
export const equipment = defineMasterData({
  module: 'core',
  entity: 'Equipment',
  plural: 'EquipmentList',
  resource: 'equipment',
  label: 'machine',
  permission: 'core.equipment',
  scopes: ['plant'],
  fields: z.object({
    groupId: z
      .uuid()
      .describe(
        "The id of the machine's equipment group, a group of the plant or of the company. A group of another plant is refused with core.crossScopeReference, an archived one that the machine did not have with core.archived.",
      ),
    isPlannable: z
      .boolean()
      .describe(
        'True when planners plan job orders on the machine. A create without it is plannable; an update without it keeps it.',
      )
      .optional(),
    isOee: z
      .boolean()
      .describe(
        "True when the machine's OEE is measured. A create without it is false; an update without it keeps it.",
      )
      .optional(),
    color: z
      .enum(['group', ...paletteColors])
      .describe(
        "The machine's own palette color for its stripe, or group for the group's color. A create without it takes the group's color; an update without it keeps it.",
      )
      .optional(),
  }),
  output: {
    groupId: z.uuid().describe("The id of the machine's equipment group."),
    isPlannable: z.boolean().describe('True when planners plan job orders on the machine.'),
    isOee: z.boolean().describe("True when the machine's OEE is measured."),
    color: paletteColor
      .nullable()
      .describe("The machine's own palette color, or null when its stripe takes the group's."),
  },
  filters: {
    groupId: z.uuid().describe('Only the machines of this equipment group.'),
    isPlannable: z.boolean().describe('Only the machines whose isPlannable is this value.'),
    onBoard: z
      .boolean()
      .describe(
        'True for the machines the planning board shows, those plannable or OEE-measured; false for the others.',
      ),
  },
});
