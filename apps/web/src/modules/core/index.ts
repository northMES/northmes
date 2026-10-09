// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineWebModule } from '@northmes/web-sdk';
import { coreRoutes, coreSettingsRoutes } from './routes.tsx';

/**
 * The core module's web part, its public api: the routes under /$plant/core and the company
 * settings routes under /settings/$companyId/core. The shell and other modules import it from this
 * file only.
 */
export const coreModule = defineWebModule({
  id: 'core',
  version: '0.0.0',
  routes: coreRoutes,
  settingsRoutes: coreSettingsRoutes,
});
