// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { defineWebModule } from '@northmes/web-sdk';
import { planningRoutes, planningSettingsRoutes } from './routes.tsx';

/**
 * The planning module's web part, its public api: the routes under /$plant/planning and its
 * settings routes under /$plant/settings/planning (#876). The shell and other modules import it
 * from this file only.
 */
export const planningModule = defineWebModule({
  id: 'planning',
  version: '0.0.0',
  routes: planningRoutes,
  settingsRoutes: planningSettingsRoutes,
});
