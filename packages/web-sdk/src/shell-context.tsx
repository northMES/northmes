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

export function useShell(): ShellState {
  return useContext(ShellContext) as ShellState;
}
