// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { ContributionsProvider, type SlotContribution, useContributions } from '@northmes/web-sdk';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

/** A contribution to `slot` at `order`, with no component. */
function contribution(id: string, slot: string, order: number): SlotContribution {
  return { id, slot, label: id, order, moduleId: 'example', moduleLabel: 'Example' };
}

function providing(contributions: readonly SlotContribution[]) {
  return ({ children }: { children: ReactNode }) => (
    <ContributionsProvider value={contributions}>{children}</ContributionsProvider>
  );
}

describe('useContributions (ADR 0068)', () => {
  it("returns the slot's contributions by their order, and none of another slot", () => {
    const wrapper = providing([
      contribution('example.late', 'core/dashboard/widgets/v1', 20),
      contribution('example.side', 'planning/board/side/v1', 10),
      contribution('example.count', 'core/dashboard/widgets/v1', 10),
    ]);

    const { result } = renderHook(() => useContributions('core/dashboard/widgets/v1'), { wrapper });

    expect(result.current.map(({ id }) => id)).toEqual(['example.count', 'example.late']);
  });

  it('returns none outside a ContributionsProvider', () => {
    const { result } = renderHook(() => useContributions('core/dashboard/widgets/v1'));

    expect(result.current).toEqual([]);
  });
});
