// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import {
  type BoardFieldRow,
  blockLines,
  boardFieldCatalog,
  effectiveBoardFields,
  shownFields,
} from '../../../src/modules/planning/board-fields.ts';
import type { GanttSnapshot } from '../../../src/modules/planning/gantt-data.ts';
import { g1Snapshot } from '../../../src/modules/planning/gantt-data-g1.ts';

const snapshot: GanttSnapshot = g1Snapshot();

/** The row of a job order of G1, by its id, as the board and the Gantt hand it over. */
function rowOf(id: string): BoardFieldRow {
  for (const order of snapshot.productionOrders) {
    const jobOrder = order.jobOrders.find((each) => each.id === id);
    const operation = order.operations.find((each) => each.id === jobOrder?.operationId);
    if (jobOrder !== undefined && operation !== undefined) {
      return { order, operation, jobOrder, analysis: snapshot.analysis.jobOrders[id] };
    }
  }
  throw new Error(`No job order ${id}`);
}

const machineName = (code: string | undefined) =>
  snapshot.equipment.find((each) => each.code === code)?.name ?? '';

const company = { block: ['article', 'quantity', 'end'], hover: ['operation', 'article'] };

describe('the board fields a plant shows (plan 07, Board settings; #762)', () => {
  it('#762 a plant without its own lists uses the company value of both', () => {
    expect(effectiveBoardFields({ company, plants: {} }, 'plant-a')).toEqual(company);
  });

  it('#762 a plant that sets one list keeps the company value of the other', () => {
    const settings = { company, plants: { 'plant-a': { hover: ['status'] } } };
    expect(effectiveBoardFields(settings, 'plant-a')).toEqual({
      block: company.block,
      hover: ['status'],
    });
    expect(effectiveBoardFields(settings, 'plant-b')).toEqual(company);
  });

  it('#762 lists the ERP keys found in the orders with a sample value and how many orders carry each', () => {
    const { erp } = boardFieldCatalog(snapshot);
    const drawing = erp.find((field) => field.id === 'erp:DRAWING_REV');
    expect(drawing).toMatchObject({ label: 'DRAWING_REV', source: 'erp', sourceLabel: 'ERP field' });
    expect(drawing?.description).toBe('C, in 5 of 6 orders');
    expect(erp.find((field) => field.id === 'erp:HEAT_TREAT')?.description).toBe(
      'Hardened, in 1 of 6 orders',
    );
  });

  it('#762 lists the module fields with the module that contributes each', () => {
    const { module } = boardFieldCatalog(snapshot);
    expect(module.map((field) => [field.id, field.sourceLabel])).toEqual([
      ['slot:connector.erpChange', 'ERP connector'],
      ['slot:tooling.toolLife', 'Acme tooling'],
    ]);
  });

  it('#762 shows the values of NorthMES, ERP and module fields in the order asked, and skips a field without a value', () => {
    const fields = shownFields(
      ['operation', 'erp:SURFACE', 'customer', 'slot:connector.erpChange', 'erp:HEAT_TREAT'],
      rowOf('jo-1001-10'),
      snapshot,
      machineName,
    );
    expect(fields.map((field) => [field.label, field.value])).toEqual([
      ['Operation', '10, Turn'],
      ['SURFACE', 'Zinc plated'],
      ['Customer', 'Hallberg Verkstad AB, Svea Komponent AB'],
      ['ERP change', 'Quantity 600 to 640 pcs, waiting'],
    ]);
  });

  it('#762 puts the first block field beside the job number, the others on the second line and module fields at the trailing edge', () => {
    const lines = blockLines(
      ['article', 'quantity', 'end', 'slot:connector.erpChange'],
      rowOf('jo-1001-10'),
      snapshot,
      machineName,
    );
    expect(lines.first).toBe('Bracket L');
    expect(lines.second).toBe('600 pcs, ends Wed 4 Nov 08:00');
    expect(lines.trailing.map((field) => field.text)).toEqual(['ERP change']);
    expect(lines.extraNames).toEqual(['pending ERP change, quantity 600 to 640 pcs']);
  });

  it('#762 names an ERP field on a block by its key, as the article and quantity need no extra words', () => {
    const lines = blockLines(['erp:DRAWING_REV', 'quantity'], rowOf('jo-1001-10'), snapshot, machineName);
    expect(lines.first).toBe('C');
    expect(lines.extraNames).toEqual(['DRAWING_REV C']);
  });
});
