// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineWebModule } from '@northmes/web-sdk';
import { planningRoutes } from './routes.tsx';

/**
 * The planning remote's ./module entry (ADR 0019). The version repeats the one in
 * modules/planning/package.json as a string literal, which the remote's build compares with it.
 */
export default defineWebModule({
  id: 'planning',
  version: '0.0.0',
  routes: planningRoutes,
});
