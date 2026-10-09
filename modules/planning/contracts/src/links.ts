// SPDX-License-Identifier: MIT
import { defineModuleLinks } from '@northmes/contracts';

/**
 * The planning module's link manifest (ADR 0062). The module's routes in apps/web take their paths
 * from it, and other modules, server code and end-to-end specs build the planning module's URLs
 * with it.
 */
export const planningLinks = defineModuleLinks('planning', {
  board: { path: 'board' },
});
