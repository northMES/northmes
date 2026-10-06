import type { AnyRoute } from "@tanstack/react-router";
import type { ComponentType } from "react";
import type { PlantRoute } from "./routes";

export interface NavItem {
  readonly id: string;
  readonly label: string;
  readonly to: string;
  readonly permission?: string;
  readonly order?: number;
}

/**
 * Props per slot id. Slots of core modules are declared here, in the MIT package, so a plugin
 * types its contribution without importing AGPL module code. The id carries a version suffix;
 * changing props means adding /v2 and keeping /v1 for a deprecation window.
 */
export interface SlotProps {
  "core/dashboard/widgets/v1": { readonly plantId: string };
  "planning/board/side/v1": { readonly plantId: string };
}
export type SlotId = keyof SlotProps;

export interface SlotContribution<S extends SlotId = SlotId> {
  readonly id: string;
  readonly slot: S;
  readonly component: ComponentType<SlotProps[S]>;
  readonly permission?: string;
  readonly order?: number;
}

/** Back-compat name used by the earlier spike. */
export type DashboardWidgetProps = SlotProps["core/dashboard/widgets/v1"];

export interface WebModule {
  readonly id: string;
  readonly version: string;
  readonly northmesRange: string;
  readonly permissions: readonly string[];
  /** Absent for a module that only contributes to other modules' slots. */
  routes?(parent: PlantRoute): AnyRoute;
  readonly nav: readonly NavItem[];
  readonly contributions: readonly SlotContribution[];
}

export function defineWebModule(module: WebModule): WebModule {
  return module;
}

export const contribute = <S extends SlotId>(c: SlotContribution<S>): SlotContribution => c as unknown as SlotContribution;

export function validateWebModule(value: unknown, expectedId: string): string[] {
  const errors: string[] = [];
  if (typeof value !== "object" || value === null) return ["module entry has no default export object"];
  const m = value as Record<string, unknown>;
  if (m.id !== expectedId) errors.push(`id is ${String(m.id)}, expected ${expectedId}`);
  for (const key of ["version", "northmesRange"] as const) if (typeof m[key] !== "string") errors.push(`${key} must be a string`);
  if (m.routes !== undefined && typeof m.routes !== "function") errors.push("routes must be a function");
  if (!Array.isArray(m.nav)) errors.push("nav must be an array");
  if (!Array.isArray(m.contributions)) errors.push("contributions must be an array");
  if (!Array.isArray(m.permissions)) errors.push("permissions must be an array");
  return errors;
}
