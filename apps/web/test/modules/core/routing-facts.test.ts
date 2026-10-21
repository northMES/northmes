// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import { plannedDuration } from '../../../src/modules/core/routing-facts.ts';
import { g1RoutingsSnapshot } from '../../../src/modules/core/routings-data-g1.ts';

const snapshot = g1RoutingsSnapshot();
const bracket = snapshot.routings.find((routing) => routing.articleNumber === '20-1001');
const operation = (sequence: number) => {
  const found = bracket?.operations.find((each) => each.sequence === sequence);
  if (found === undefined) throw new Error(`No operation ${sequence}`);
  return found;
};

describe('the routings of the fixture G1 (design #729, RO1)', () => {
  it("#729 reads Bracket L's operations from G1 with how each value was entered and its machines and tools", () => {
    expect(bracket?.articleName).toBe('Bracket L');
    expect(bracket?.erpVersion).toBe(3);
    expect(bracket?.openOrders.map((order) => [order.number, order.quantity])).toEqual([
      ['1001', 600],
      ['1005', 600],
    ]);
    const turn = operation(10);
    expect([turn.name, turn.cycleSeconds, turn.retoolSeconds, turn.leadTimeS]).toEqual([
      'Turn',
      30,
      1800,
      0,
    ]);
    expect(turn.cycleEntered).toEqual({ value: 120, unit: 'piecesPerHour' });
    expect(
      turn.machines.map((machine) => [machine.name, machine.default, machine.retoolSeconds]),
    ).toEqual([
      ['CNC 1', true, undefined],
      ['CNC 2', false, 2400],
    ]);
    expect(
      turn.materials.map((material) => [material.number, material.perPiece, material.warehouse]),
    ).toEqual([['30-2020', 0.12, 'A-RM']]);
    const mill = operation(20);
    expect(mill.leadTimeS).toBe(3600);
    expect(mill.kept?.erpLeadTimeS).toBe(1800);
    expect(mill.tools.map((tool) => [tool.code, tool.name, tool.piecesPerCycle])).toEqual([
      ['T-311', 'Fixture BR-L 2-up', 2],
    ]);
  });
});

describe('the planned duration of an operation (plan 07, Planned duration; ADR 0027)', () => {
  it("#729 RO1 computes 600 pcs of operation 20 on CNC 2 without a tool: 10 h, every input the operation's", () => {
    const duration = plannedDuration(operation(20), 'CNC2', undefined, 600);

    expect(duration.inputs.map((input) => [input.label, input.value, input.source])).toEqual([
      ['Cycle time', 60, 'Operation'],
      ['Pieces per cycle', 1, 'Operation'],
      ['Cycles per piece', 1, 'Operation'],
      ['Retool', 0, 'Operation'],
      ['Fixed time', 0, 'Operation'],
      ['Planning factor', 1, 'Plant setting'],
    ]);
    expect([duration.setupS, duration.cycles, duration.runS, duration.totalS]).toEqual([
      0, 600, 36_000, 36_000,
    ]);
  });

  it("#729 RO1 lets the tool's pieces per cycle win over the machine's, and the machine's cycle time over the operation's", () => {
    expect(plannedDuration(operation(20), 'CNC2', 'T-311', 600).totalS).toBe(18_000);
    expect(plannedDuration(operation(20), 'MILL1', undefined, 600).totalS).toBe(27_000);
    const both = plannedDuration(operation(20), 'MILL1', 'T-311', 600);
    expect(both.totalS).toBe(13_500);
    expect(both.inputs.find((input) => input.label === 'Cycle time')?.source).toBe('Machine');
    expect(both.inputs.find((input) => input.label === 'Pieces per cycle')?.source).toBe('Tool');
  });

  it("#729 RO1 takes CNC 2's retool override on operation 10: 5 h 40 min against CNC 1's 5 h 30 min", () => {
    expect(plannedDuration(operation(10), 'CNC1', undefined, 600).totalS).toBe(19_800);
    expect(plannedDuration(operation(10), 'CNC2', undefined, 600).totalS).toBe(20_400);
  });

  it('#729 RO1 divides the run by the OEE target when the plant uses it, rounding up as the domain does', () => {
    const duration = plannedDuration(operation(20), 'CNC2', undefined, 600, 'oeeTarget');

    expect(duration.inputs.at(-1)).toEqual({
      label: 'Planning factor',
      value: 0.8,
      source: 'Operation',
    });
    expect(duration.runS).toBe(45_000);
    expect(plannedDuration(operation(10), 'CNC1', undefined, 7, 'oeeTarget').runS).toBe(248);
  });

  it("#729 RO1 lets a tool's pieces per cycle win over a machine's, and the machine's cycles per piece over the operation's", () => {
    const synthetic = {
      ...operation(20),
      machines: [
        {
          code: 'X1',
          name: 'X 1',
          default: true,
          piecesPerCycle: 3,
          cyclesPerPiece: 2,
          source: 'erp' as const,
        },
      ],
      tools: [{ code: 'TX', name: 'Tool X', piecesPerCycle: 2, source: 'erp' as const }],
    };

    const withTool = plannedDuration(synthetic, 'X1', 'TX', 10);
    expect(withTool.inputs.find((input) => input.label === 'Pieces per cycle')).toMatchObject({
      value: 2,
      source: 'Tool',
    });
    expect(withTool.inputs.find((input) => input.label === 'Cycles per piece')).toMatchObject({
      value: 2,
      source: 'Machine',
    });
    expect(withTool.cycles).toBe(10);
    expect(plannedDuration(synthetic, 'X1', undefined, 10).cycles).toBe(7);
  });
});
