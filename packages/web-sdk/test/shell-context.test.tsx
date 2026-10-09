// SPDX-License-Identifier: MIT
import { ShellProvider, useShell } from '@northmes/web-sdk';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

function shellAt(plant: string) {
  return ({ children }: { children: ReactNode }) => (
    <ShellProvider value={{ plant }}>{children}</ShellProvider>
  );
}

describe('useShell', () => {
  it("E02-S05 useShell returns the state of the shell's ShellProvider", () => {
    const { result } = renderHook(() => useShell(), { wrapper: shellAt('plant-a') });

    expect(result.current.plant).toBe('plant-a');
  });

  it('E02-S05 useShell throws outside a ShellProvider', () => {
    expect(() => renderHook(() => useShell())).toThrow(
      'useShell() found no ShellProvider: render it inside the $plant route',
    );
  });
});
