import type { AnyRoute } from "@tanstack/react-router";
import type { ComponentType } from "react";
import type { PlantRoute } from "./routes";

/** A sidebar entry contributed by a module. */
export interface NavItem {
  readonly id: string;
  readonly label: string;
  /** Path below the plant, for example "planning/board". */
  readonly to: string;
  readonly permission?: string;
  readonly order?: number;
}

/** Props every widget in a slot receives. Versioned by the slot id. */
export interface DashboardWidgetProps {
  readonly plantId: string;
}

export interface WidgetContribution {
  readonly id: string;
  /** Slot ids carry a version suffix, Grafana style. */
  readonly slot: "core/dashboard/widgets/v1";
  readonly component: ComponentType<DashboardWidgetProps>;
  readonly permission?: string;
  readonly order?: number;
}

/** What a remote's "./module" entry exports as default. */
export interface WebModule {
  readonly id: string;
  readonly version: string;
  /** Semver range of NorthMES versions this module runs on. */
  readonly northmesRange: string;
  readonly permissions: readonly string[];
  /** Called once by the shell, with the shell's own plant route instance. */
  routes(parent: PlantRoute): AnyRoute;
  readonly nav: readonly NavItem[];
  readonly widgets: readonly WidgetContribution[];
}

export function defineWebModule(module: WebModule): WebModule {
  return module;
}

/** Runtime validation the shell (and the contract test) run on every loaded module. */
export function validateWebModule(value: unknown, expectedId: string): string[] {
  const errors: string[] = [];
  if (typeof value !== "object" || value === null) return ["module entry has no default export object"];
  const m = value as Record<string, unknown>;
  if (m.id !== expectedId) errors.push(`id is ${String(m.id)}, expected ${expectedId}`);
  for (const key of ["version", "northmesRange"] as const) {
    if (typeof m[key] !== "string") errors.push(`${key} must be a string`);
  }
  if (typeof m.routes !== "function") errors.push("routes must be a function");
  if (!Array.isArray(m.nav)) errors.push("nav must be an array");
  if (!Array.isArray(m.widgets)) errors.push("widgets must be an array");
  if (!Array.isArray(m.permissions)) errors.push("permissions must be an array");
  return errors;
}
