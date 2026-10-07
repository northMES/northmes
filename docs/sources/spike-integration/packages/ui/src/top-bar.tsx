import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// The shell owns the element; any module renders into it. This context is the kind that
// broke in the earlier attempt when @mes/ui was bundled once per remote.
const TopBarContext = createContext<HTMLElement | null | undefined>(undefined);

export function TopBarProvider({ children }: { children: (setSlot: (el: HTMLElement | null) => void) => ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  return <TopBarContext.Provider value={slot}>{children(setSlot)}</TopBarContext.Provider>;
}

export function TopBarActions({ children }: { children: ReactNode }) {
  const slot = useContext(TopBarContext);
  if (slot === undefined) throw new Error("TopBarActions outside TopBarProvider: @northmes/ui is not shared");
  return slot ? createPortal(children, slot) : null;
}
