// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { plant, renderPlanningAt } from './gantt-fixtures.tsx';

afterEach(cleanup);

describe('planning web module', () => {
  it("E02-S05 a plant's planningLinks.board href opens the planning board", async () => {
    renderPlanningAt(planningLinks.board({ plant }).href);

    expect(await screen.findByRole('heading', { level: 1, name: 'Planning board' })).toBeTruthy();
  });
});
