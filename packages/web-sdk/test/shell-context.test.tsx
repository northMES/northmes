// SPDX-License-Identifier: MIT
import { ShellProvider, useShell } from '@northmes/web-sdk';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

function shellAt(plantId: string) {
  return ({ children }: { children: ReactNode }) => (
    <ShellProvider value={{ plantId }}>{children}</ShellProvider>
  );
}

describe('useShell', () => {
  it("E02-S05 useShell returns the state of the shell's ShellProvider", () => {
    const { result } = renderHook(() => useShell(), { wrapper: shellAt('plant-a') });

    expect(result.current.plantId).toBe('plant-a');
  });

  it('E02-S05 useShell throws when a module holds a second copy of the shell context', async () => {
    // A remote that bundles its own @northmes/web-sdk instead of taking the shared singleton
    // evaluates the package a second time and gets a context of its own.
    vi.resetModules();
    const moduleCopy = await import('@northmes/web-sdk');
    expect(moduleCopy.useShell).not.toBe(useShell);

    expect(() => renderHook(() => moduleCopy.useShell(), { wrapper: shellAt('plant-a') })).toThrow(
      'useShell() found no ShellProvider: the shell and this module hold two copies of @northmes/web-sdk',
    );
  });
});
