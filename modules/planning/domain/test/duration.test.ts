// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import { plannedSeconds, runSecondsFor, setupSeconds } from '../src/index.ts';

/** The TC1 rates of plan 07: 45 s cycles of 3 pieces, OEE target 0.75, retool 2 700 s. */
const tc1 = {
  cycleSeconds: 45,
  piecesPerCycle: 3,
  cyclesPerPiece: 1,
  planningFactor: 0.75,
  retoolSeconds: 2700,
  fixedSeconds: 0,
};

describe('planned duration (ADR 0027, plan 07 TC1 to TC12)', () => {
  it('TC1 7 200 pieces at the TC1 rates take 2 400 cycles, 144 000 s of run and 146 700 s in all', () => {
    expect(runSecondsFor(7200, tc1)).toBe(144_000);
    expect(setupSeconds(tc1)).toBe(2700);
    expect(plannedSeconds(7200, tc1)).toBe(146_700);
  });

  it('TC4 a partial cycle rounds up: 7 201 pieces take 2 401 cycles and 146 760 s', () => {
    expect(plannedSeconds(7201, tc1)).toBe(146_760);
  });

  it('TC3 two cycles per piece and one piece per cycle give 14 400 cycles and 864 000 s of run', () => {
    expect(runSecondsFor(7200, { ...tc1, piecesPerCycle: 1, cyclesPerPiece: 2 })).toBe(864_000);
  });

  it('TC9b the send-ahead release is cycle-quantized: 318 pieces take 6 360 s and 319 take 6 420 s', () => {
    expect(runSecondsFor(318, tc1)).toBe(6360);
    expect(runSecondsFor(319, tc1)).toBe(6420);
  });

  it('quantity 0 gives setup only', () => {
    expect(runSecondsFor(0, tc1)).toBe(0);
    expect(plannedSeconds(0, tc1)).toBe(2700);
  });

  it('G1 1004.10: 1 200 pieces at 30 s with a 30 min retool take 37 800 s, 300 pieces of run 9 000 s', () => {
    const rates = {
      ...tc1,
      cycleSeconds: 30,
      piecesPerCycle: 1,
      planningFactor: 1,
      retoolSeconds: 1800,
    };

    expect(plannedSeconds(1200, rates)).toBe(37_800);
    expect(runSecondsFor(300, rates)).toBe(9000);
  });
});
