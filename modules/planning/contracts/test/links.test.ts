// SPDX-License-Identifier: MIT
import { planningLinks } from '@northmes/planning-contracts';
import { describe, expect, it } from 'vitest';

describe('planningLinks', () => {
  it("E02-S05 planningLinks.board builds the href of a plant's planning board", () => {
    expect(planningLinks.board({ plant: 'plant-a' }).href).toBe('/plant-a/planning/board');
  });
});
