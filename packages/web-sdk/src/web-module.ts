// SPDX-License-Identifier: MIT
import type { AnyRoute } from '@tanstack/react-router';
import type { PlantRoute } from './routes.ts';

/**
 * A module's web part, which apps/web/src/modules.ts imports and passes to createShellRoutes. It
 * has no nav list (ADR 0062).
 */
export interface WebModule {
  /** Equals the module's manifest id and its path segment under /$plant. */
  readonly id: string;
  /** Equals the module's manifest version. */
  readonly version: string;
  /** Returns the module's route subtree, whose top route has the module id as its path. */
  routes(plantRoute: PlantRoute): AnyRoute;
}

export function defineWebModule(module: WebModule): WebModule {
  return module;
}
