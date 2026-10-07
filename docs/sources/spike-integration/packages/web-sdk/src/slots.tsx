import { Component, createContext, type ReactNode, useContext } from "react";
import type { SlotContribution, SlotId, SlotProps } from "./contract";

const SlotRegistryContext = createContext<ReadonlyMap<string, readonly SlotContribution[]> | null>(null);

export function SlotRegistryProvider({ value, children }: { value: ReadonlyMap<string, readonly SlotContribution[]>; children: ReactNode }) {
  return <SlotRegistryContext.Provider value={value}>{children}</SlotRegistryContext.Provider>;
}

class SlotBoundary extends Component<{ id: string; children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  override render() {
    if (this.state.error) return <div data-testid={`slot-error-${this.props.id}`}>{this.props.id} failed: {this.state.error.message}</div>;
    return this.props.children;
  }
}

/** Rendered by the module that owns the slot. Each contribution gets its own error boundary. */
export function Slot<S extends SlotId>({ id, props }: { id: S; props: SlotProps[S] }) {
  const registry = useContext(SlotRegistryContext);
  const items = (registry?.get(id) ?? []) as readonly SlotContribution<S>[];
  return (
    <div data-slot={id}>
      {items.map((c) => {
        const C = c.component as unknown as (p: SlotProps[S]) => ReactNode;
        return <SlotBoundary key={c.id} id={c.id}><C {...props} /></SlotBoundary>;
      })}
    </div>
  );
}
