// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
export {
  type CreateNorthmesClientOptions,
  createNorthmesClient,
  type NorthmesClientAuth,
} from './apollo.ts';
export { type ClassifiedError, classifyError, type ErrorPage } from './classify-error.ts';
export {
  ContributionsProvider,
  type SlotContribution,
  useContributions,
} from './contributions.tsx';
export {
  HOST_PROVIDED_WEB,
  type HostProvidedWeb,
  isHostProvidedWeb,
} from './host-provided-web.ts';
export {
  coreModuleId,
  createShellRoutes,
  type PlantBeforeLoad,
  type PlantRoute,
  type RootRoute,
  type SettingsRoute,
  type ShellRoutesOptions,
  settingsHref,
  settingsPath,
} from './routes.ts';
export { ShellProvider, type ShellState, useShell } from './shell-context.tsx';
export { defineWebModule, type HelpEntry, type WebModule } from './web-module.ts';
