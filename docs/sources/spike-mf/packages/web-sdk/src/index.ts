// Every export is named. This package is a federation singleton; never use `export *` here.
export { createNorthmesClient, type CreateNorthmesClientOptions } from "./apollo";
export {
  defineWebModule,
  validateWebModule,
  type DashboardWidgetProps,
  type NavItem,
  type WebModule,
  type WidgetContribution,
} from "./contract";
export { ShellProvider, useShell, type ShellState } from "./shell-context";
export { NORTHMES_VERSION, satisfiesRange } from "./version";
