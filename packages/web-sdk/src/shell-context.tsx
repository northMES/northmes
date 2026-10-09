// SPDX-License-Identifier: MIT
import { createContext, type ReactNode, useContext } from 'react';

/** State the shell owns and every module reads. */
export interface ShellState {
  /** The plant's slug, the $plant segment of the URL, which a module's links take as `plant`. */
  readonly plant: string;
}

const ShellContext = createContext<ShellState | null>(null);

/** Rendered only by the shell, once per $plant route. */
export function ShellProvider({ value, children }: { value: ShellState; children: ReactNode }) {
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

/**
 * Reads the shell's state. Outside a ShellProvider there is no state to read, so the hook throws
 * instead of returning nothing.
 */
export function useShell(): ShellState {
  const value = useContext(ShellContext);
  if (value === null) {
    throw new Error('useShell() found no ShellProvider: render it inside the $plant route');
  }
  return value;
}
