// SPDX-License-Identifier: MIT
import type { AnyRoute } from '@tanstack/react-router';
import type { PlantRoute, SettingsRoute } from './routes.ts';

/** One entry of the shell's one help menu, where it shows under its module's label (ADR 0062). */
export interface HelpEntry {
  /** Unique across modules, such as planning.board-keys. */
  readonly id: string;
  readonly label: string;
  /** An app path or the URL of a docs page. */
  readonly href: string;
}

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
  /**
   * Returns the module's company settings subtree under /settings/$companyId, whose top route has
   * the module id as its path (ADR 0066). Only core has one in release 1.
   */
  settingsRoutes?(settingsRoute: SettingsRoute): AnyRoute;
  /** The module's entries in the help menu; a module never adds a help menu of its own. */
  readonly help?: readonly HelpEntry[];
}

export function defineWebModule(module: WebModule): WebModule {
  return module;
}
