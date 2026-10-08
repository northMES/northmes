// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineWebModule } from '@northmes/web-sdk';
import { planningRoutes } from './routes.tsx';

/**
 * The planning module's web part, its public api: the routes under /$plant/planning. The shell and
 * other modules import it from this file only.
 */
export const planningModule = defineWebModule({
  id: 'planning',
  version: '0.0.0',
  routes: planningRoutes,
});
