// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { defineMasterData, paletteColor } from '@northmes/contracts';
import { z } from 'zod';

/**
 * Where a group's color came from: the ERP named it, a person set it, or the create took the first
 * palette color that no group the request sees used.
 */
export const colorFrom = z.enum(['erp', 'set', 'palette']);

/**
 * Equipment groups, such as Assembly or Turning: a register at the company, which every plant of it
 * sees, or at one plant (ADR 0007). Codes are unique among the groups a scope sees (ADR 0009), and
 * each group has a palette color, which the planning board's group band shows. Company admin
 * changes the company's groups, Plant admin its plant's.
 */
export const equipmentGroups = defineMasterData({
  module: 'core',
  entity: 'EquipmentGroup',
  resource: 'equipment-groups',
  label: 'equipment group',
  article: 'an',
  permission: 'core.equipmentGroup',
  scopes: ['company', 'plant'],
  fields: z.object({
    color: paletteColor
      .describe(
        "The group's palette color. A create without one takes the first palette color that no group the request sees uses; an update without one keeps it.",
      )
      .optional(),
  }),
  output: {
    color: paletteColor.describe("The group's palette color."),
    colorFrom: colorFrom.describe(
      "Where the color came from: erp, set by a person, or palette, the first free color at the group's create.",
    ),
  },
});
