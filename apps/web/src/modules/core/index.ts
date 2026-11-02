// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreModuleId, defineWebModule } from '@northmes/web-sdk';
import { coreRoutes, coreSettingsRoutes } from './routes.tsx';

/**
 * The core module's web part, its public api: the routes at the plant root, such as
 * /$plant/articles, and the settings routes at the settings root, such as /$plant/settings/machines
 * and /$plant/settings/users (ADR 0074, #876). The shell and other modules import it from this
 * file only.
 */
export const coreModule = defineWebModule({
  id: coreModuleId,
  version: '0.0.0',
  routes: coreRoutes,
  settingsRoutes: coreSettingsRoutes,
});
