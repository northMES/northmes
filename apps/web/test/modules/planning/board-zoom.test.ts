// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import { g1Snapshot } from '../../../src/modules/planning/gantt-data-g1.ts';
import { boardFitTargetOf } from '../../../src/modules/planning/screens/board/board-rows.ts';

describe('what Zoom to fit fits on the board (ADR 0089, Zoom levels)', () => {
  it('#896 fits every loaded job order with nothing selected: G1 from Tue 3 Nov 11:30 to Tue 10 Nov 15:00', () => {
    expect(boardFitTargetOf(g1Snapshot(), undefined)).toEqual({
      span: { fromMs: Date.UTC(2026, 10, 3, 10, 30), toMs: Date.UTC(2026, 10, 10, 14) },
      name: 'every loaded job order',
    });
  });

  it("#896 fits the selected order's job orders", () => {
    expect(boardFitTargetOf(g1Snapshot(), 'po-1003')).toEqual({
      span: { fromMs: Date.UTC(2026, 10, 4, 7), toMs: Date.UTC(2026, 10, 5, 5, 15) },
      name: 'order 1003',
    });
  });
});
