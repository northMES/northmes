// SPDX-License-Identifier: MIT
import { createContext, type ReactNode, useContext } from 'react';

/** State the shell owns and every module reads. */
export interface ShellState {
  /** The plant's scope id from the $plant segment. */
  readonly plantId: string;
}

const ShellContext = createContext<ShellState | null>(null);

/** Rendered only by the shell, once per $plant route. */
export function ShellProvider({ value, children }: { value: ShellState; children: ReactNode }) {
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

/**
 * Reads the shell's state. A module that bundles its own copy of this package reads a context the
 * shell never provided, so the hook throws instead of returning nothing.
 */
export function useShell(): ShellState {
  const value = useContext(ShellContext);
  if (value === null) {
    throw new Error(
      'useShell() found no ShellProvider: the shell and this module hold two copies of @northmes/web-sdk',
    );
  }
  return value;
}
