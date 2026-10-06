// Every export is named. This package is a federation singleton; never use `export *` here.
export { createNorthmesClient, type CreateNorthmesClientOptions } from "./apollo";
export {
  contribute,
  defineWebModule,
  validateWebModule,
  type DashboardWidgetProps,
  type NavItem,
  type SlotContribution,
  type SlotId,
  type SlotProps,
  type WebModule,
} from "./contract";
export { Slot, SlotRegistryProvider } from "./slots";
export { ShellProvider, useShell, type ShellState } from "./shell-context";
export { NORTHMES_VERSION, satisfiesRange } from "./version";
