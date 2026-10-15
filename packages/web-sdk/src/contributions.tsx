// SPDX-License-Identifier: MIT
import { type ComponentType, createContext, type ReactNode, useContext, useMemo } from 'react';

/**
 * One contribution to a slot (ADR 0068): the data of its manifest entry, its module, and the
 * component the module's web part supplies under its id. A contribution without a component is
 * one whose module did not load, or whose web part supplies none; its slot shows a fallback.
 */
export interface SlotContribution {
  /** Starts with the module id, such as example-article-count.count. */
  readonly id: string;
  /** The slot id `<owner>/<area>/<name>/v<N>`. */
  readonly slot: string;
  readonly label: string;
  readonly order: number;
  readonly moduleId: string;
  readonly moduleLabel: string;
  /** Takes the props the slot's owner declares. */
  // biome-ignore lint/suspicious/noExplicitAny: each slot declares its own props.
  readonly Component?: ComponentType<any>;
}

const ContributionsContext = createContext<readonly SlotContribution[]>([]);

/**
 * Rendered by the shell with the contributions of every module it loaded that the user may see,
 * filtered by each contribution's permission.
 */
export function ContributionsProvider({
  value,
  children,
}: {
  value: readonly SlotContribution[];
  children: ReactNode;
}) {
  return <ContributionsContext.Provider value={value}>{children}</ContributionsContext.Provider>;
}

/** The contributions to a slot, by their order: what the slot's owner renders. */
export function useContributions(slot: string): readonly SlotContribution[] {
  const all = useContext(ContributionsContext);
  return useMemo(
    () => all.filter((entry) => entry.slot === slot).sort((a, b) => a.order - b.order),
    [all, slot],
  );
}
