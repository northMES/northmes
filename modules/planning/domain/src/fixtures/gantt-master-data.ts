// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { z } from 'zod';
import masterDataJson from '../../fixtures/gantt/g1.master-data.json' with { type: 'json' };
import { timePoint } from './gantt.ts';

/**
 * What the routing, tools and equipment group pages of design #729 show beside the fixture G1:
 * per routing operation how its cycle time was entered, its OEE target, the machines it allows
 * with their overrides, its tools and whether a planner keeps NorthMES values (plan 07, Planned
 * duration; ADR 0027); and the tools of the company and the plant. G1's rates, lead times and the
 * pages fixture's allowed machines stay the source of the values the Gantt reads.
 */

/** Who set a value: the ERP through the connector, the import on its own, or NorthMES. */
export const masterDataSource = z.enum(['erp', 'import', 'northmes']);

export const routingMachine = z.object({
  code: z.string(),
  default: z.boolean(),
  /** The machine's overrides of the operation's values (ADR 0027); none inherits. */
  cycleSeconds: z.number().positive().optional(),
  piecesPerCycle: z.number().int().positive().optional(),
  cyclesPerPiece: z.number().int().positive().optional(),
  retoolSeconds: z.number().nonnegative().optional(),
  source: masterDataSource,
  addedBy: z.string().optional(),
});

export const routingTool = z.object({
  code: z.string(),
  /** The tool's pieces per cycle, which wins over the machine's and the operation's. */
  piecesPerCycle: z.number().int().positive().optional(),
  source: masterDataSource,
});

export const routingOperationDetail = z.object({
  sequence: z.number().int().positive(),
  /** How the cycle time was entered: seconds per cycle, or pieces per hour (ADR 0023). */
  cycleEntered: z.object({
    value: z.number().positive(),
    unit: z.enum(['seconds', 'piecesPerHour']),
  }),
  oeeTarget: z.number().positive().max(1),
  /** Keep NorthMES values: the import leaves the operation unchanged (plan 07, do_not_update). */
  kept: z
    .object({
      since: timePoint,
      by: z.string(),
      reason: z.string(),
      /** The lead time the ERP sends, which the planner's value replaces. */
      erpLeadTimeSeconds: z.number().nonnegative(),
    })
    .optional(),
  machines: z.array(routingMachine).nonempty(),
  tools: z.array(routingTool),
});

export const routingDetail = z.object({
  article: z.string(),
  erpVersion: z.number().int().positive(),
  importedAt: timePoint,
  operations: z.array(routingOperationDetail).nonempty(),
});

export const tool = z.object({
  code: z.string(),
  name: z.string(),
  /** The plant the tool belongs to; null for a tool of the company. */
  plant: z.string().nullable(),
  source: masterDataSource,
  importedAt: timePoint,
});

/**
 * An equipment group's scope, where its color came from (ADR 0026: the ERP's, set in NorthMES, or
 * the first palette color no other group used) and its source. A group G1 and the pages fixture
 * lack carries its name and color here.
 */
export const equipmentGroupDetail = z.object({
  code: z.string(),
  name: z.string().optional(),
  color: z.string().optional(),
  scope: z.enum(['company', 'plant']),
  colorFrom: z.enum(['erp', 'set', 'palette']),
  source: z.enum(['erp', 'northmes']),
});

export const ganttMasterDataFixture = z.object({
  id: z.literal('G1-master-data'),
  description: z.string(),
  /** The company the tools of no plant belong to, by the name a page shows. */
  company: z.object({ name: z.string() }),
  routings: z.array(routingDetail).nonempty(),
  tools: z.array(tool).nonempty(),
  equipmentGroups: z.array(equipmentGroupDetail).nonempty(),
});

export type GanttMasterDataFixture = z.infer<typeof ganttMasterDataFixture>;

/** The master data fixture beside G1, parsed once. */
export const g1MasterData: GanttMasterDataFixture = ganttMasterDataFixture.parse(masterDataJson);
