// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type { AnyRoute } from '@tanstack/react-router';
import type { ComponentType } from 'react';
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
  /**
   * Equals the module's manifest id and its path segment under /$plant. Core's pages sit at the
   * plant root without it (ADR 0074).
   */
  readonly id: string;
  /** Equals the module's manifest version. */
  readonly version: string;
  /**
   * Returns the module's route subtree, whose top route has the module id as its path. Core's top
   * route is pathless (ADR 0074). A plugin whose screens are only contributions, such as a
   * dashboard widget, has none.
   */
  routes?(plantRoute: PlantRoute): AnyRoute;
  /**
   * Returns the module's company settings subtree under /settings/$companyId, whose top route has
   * the module id as its path (ADR 0066), or for core no path (ADR 0074). Only core has one in
   * release 1.
   */
  settingsRoutes?(settingsRoute: SettingsRoute): AnyRoute;
  /** The module's entries in the help menu; a module never adds a help menu of its own. */
  readonly help?: readonly HelpEntry[];
  /**
   * The components of the module's contributions to slots, by the contribution id of its manifest
   * entry under web.contributes (ADR 0068). Each takes the props its slot's owner declares, such as
   * `{ plant }` for core/dashboard/widgets/v1.
   */
  // biome-ignore lint/suspicious/noExplicitAny: each slot declares its own props.
  readonly contributions?: Readonly<Record<string, ComponentType<any>>>;
}

export function defineWebModule(module: WebModule): WebModule {
  return module;
}
