// SPDX-License-Identifier: MIT
import type { AnyRoute } from '@tanstack/react-router';
import type { PlantRoute } from './routes.ts';

/** The default export of a remote's ./module entry (ADR 0019). It has no nav list (ADR 0062). */
export interface WebModule {
  /** Equals the module's manifest id and its path segment under /$plant. */
  readonly id: string;
  /** Equals the module's manifest version. */
  readonly version: string;
  /** Returns the module's route subtree, whose top route has the module id as its path. */
  routes(plantRoute: PlantRoute): AnyRoute;
}

/** The server's entry for one module in the web module list. */
export interface WebModuleEntry {
  readonly id: string;
  readonly version: string;
}

export function defineWebModule(module: WebModule): WebModule {
  return module;
}

/** Returns one problem for each way the value a remote exported differs from its server entry. */
export function validateWebModule(value: unknown, entry: WebModuleEntry): string[] {
  const module = value as Partial<Record<keyof WebModule, unknown>>;
  const problems: string[] = [];
  if (module.id !== entry.id) {
    problems.push(`id is ${shown(module.id)}, expected ${entry.id} from the server entry`);
  }
  if (module.version !== entry.version) {
    problems.push(
      `version is ${shown(module.version)}, expected ${entry.version} from the server entry`,
    );
  }
  return problems;
}

function shown(field: unknown): string {
  return field === undefined ? 'missing' : String(field);
}
