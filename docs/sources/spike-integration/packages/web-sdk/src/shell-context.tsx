import { createContext, useContext, type ReactNode } from "react";

/** State the shell owns and every module reads. Created once, inside this shared package. */
export interface ShellState {
  readonly plantId: string;
  readonly userName: string;
  readonly permissions: ReadonlySet<string>;
}

const ShellContext = createContext<ShellState | null>(null);

export function ShellProvider({ value, children }: { value: ShellState; children: ReactNode }) {
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell(): ShellState {
  const value = useContext(ShellContext);
  if (value === null) throw new Error("useShell() outside ShellProvider: the shell and this module hold different copies of @northmes/web-sdk");
  return value;
}
