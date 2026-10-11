// SPDX-License-Identifier: AGPL-3.0-or-later
import { coreModuleId, defineWebModule } from '@northmes/web-sdk';
import { coreRoutes, coreSettingsRoutes } from './routes.tsx';

/**
 * The core module's web part, its public api: the routes at the plant root, such as
 * /$plant/articles, and the company settings routes at the company settings root, such as
 * /settings/$companyId/users (ADR 0074). The shell and other modules import it from this file only.
 */
export const coreModule = defineWebModule({
  id: coreModuleId,
  version: '0.0.0',
  routes: coreRoutes,
  settingsRoutes: coreSettingsRoutes,
});
