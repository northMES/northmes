// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { g1Expected } from '@northmes/planning-domain';
import { describe, expect, it } from 'vitest';
import { g1Snapshot } from '../../../src/modules/planning/gantt-data-g1.ts';

/**
 * g1.expected.json is the oracle of phase 2 (plan 18): the values the calculator script produced
 * for G1, which the domain functions now compute. The snapshot's analysis, built from floatOf,
 * criticalChain, releaseOf and workload, deep-equals them, mapped to the snapshot's shape. The
 * fixture's prose details are not compared.
 */
const ms = (instant: string) => Date.parse(instant);

describe('the G1 analysis against g1.expected.json (plan 18, phase 2)', () => {
  const { analysis, productionOrders } = g1Snapshot();
  const jobOrderId = (displayNumber: string) =>
    productionOrders
      .flatMap((order) => order.jobOrders)
      .find((row) => row.displayNumber === displayNumber)?.id ?? '';

  it('GT1 GT2 the floats of the four rows equal the expected values', () => {
    const floats = Object.fromEntries(
      Object.keys(g1Expected.GT1_GT2_floats).map((displayNumber) => [
        displayNumber,
        analysis.jobOrders[jobOrderId(displayNumber)]?.float,
      ]),
    );
    const expected = Object.fromEntries(
      Object.entries(g1Expected.GT1_GT2_floats).map(([displayNumber, values]) => {
        const { detail: _detail, ...binding } = values.bindingConstraint;
        return [
          displayNumber,
          {
            earliestStartMs: ms(values.earliestStart.instant),
            waitWorkingS: values.waitWorkingS,
            latestStartMs: ms(values.latestStart.instant),
            latestEndMs: ms(values.latestEnd.instant),
            totalFloatWorkingS: values.totalFloatWorkingS,
            freeFloatWorkingS: values.freeFloatWorkingS,
            binding,
            critical: values.critical,
          },
        ];
      }),
    );

    expect(floats).toEqual(expected);
  });

  it('GT1 GT2 the slack, late-by and chains of 1001 and 1003 equal the expected values', () => {
    const chainOf = (orderId: string) =>
      analysis.orders[orderId]?.chain?.rows.map((row) => ({
        row: row.row,
        bindingConstraint: row.bindingText,
        ...(row.critical && { critical: true }),
        ...(row.root && { root: true }),
        ...(row.otherOrder !== undefined && {
          otherOrder: row.otherOrder,
          totalFloatWorkingS: row.totalFloatWorkingS,
        }),
      }));

    expect(analysis.orders['po-1001']).toMatchObject({
      late: false,
      slackElapsedS: g1Expected.GT1_float_1001.slackToDeadlineElapsedS,
      plannedEndMs: ms(g1Expected.GT1_float_1001.plannedEnd.instant),
    });
    expect(chainOf('po-1001')).toEqual(g1Expected.GT1_chain_1001.chain);
    expect(analysis.orders['po-1001']?.chain?.criticalRows).toEqual(
      g1Expected.GT1_chain_1001.criticalRows,
    );
    expect(analysis.orders['po-1003']).toMatchObject({
      late: true,
      slackElapsedS: -g1Expected.GT2_late_chain_1003.lateByElapsedS,
      lateByWorking: {
        seconds: g1Expected.GT2_late_chain_1003.lateByWorkingSOnMILL1,
        equipment: 'MILL1',
      },
      plannedEndMs: ms(g1Expected.GT2_late_chain_1003.plannedEnd.instant),
    });
    expect(chainOf('po-1003')).toEqual(g1Expected.GT2_chain_1003.chain);
    expect(analysis.orders['po-1003']?.chain?.criticalRows).toEqual(
      g1Expected.GT2_chain_1003.criticalRows,
    );
  });

  it('GT4 the release of 1004.20 equals the expected send-ahead instants', () => {
    expect(analysis.jobOrders['jo-1004-20']?.release).toMatchObject({
      fromRow: '1004.10',
      pointMs: ms(g1Expected.GT4_send_ahead_last_piece_1004.releaseOf300Pieces.instant),
      atMs: ms(g1Expected.GT4_send_ahead_last_piece_1004.releaseWithLead1800.instant),
    });
    expect(
      analysis.jobOrders['jo-1004-20']?.constraints.find((line) => line.kind === 'lastPiece')?.text,
    ).toContain('Fri 6 Nov 08:45');
  });

  it('GT5 the workload of the five production days equals the expected table', () => {
    const days = new Set(g1Expected.GT5_workload_week45.map((bucket) => bucket.productionDay));
    const buckets = analysis.workload
      .filter((bucket) => days.has(bucket.label))
      .map(
        ({
          label,
          equipment,
          availableS,
          loadedS,
          setupS,
          runS,
          utilizationPermille,
          overloadS,
          items,
        }) => ({
          productionDay: label,
          equipment,
          availableS,
          loadedS,
          setupS,
          runS,
          utilizationPermille,
          overloadS,
          items,
        }),
      );

    expect(buckets).toEqual(g1Expected.GT5_workload_week45);
  });

  it('GT7 the placements of every row equal the expected placements, segments included', () => {
    for (const order of productionOrders) {
      for (const row of order.jobOrders) {
        const expected = g1Expected.placements[row.displayNumber];
        expect(row.placement, row.displayNumber).toEqual({
          setupStartMs: ms(expected?.start.instant ?? ''),
          runStartMs: row.placement?.runStartMs,
          endMs: ms(expected?.end.instant ?? ''),
          segments: expected?.segments.map(({ from, to }) => ({ fromMs: ms(from), toMs: ms(to) })),
        });
      }
    }
  });
});
