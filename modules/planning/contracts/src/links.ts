// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { defineModuleLinks } from '@northmes/contracts';

/**
 * The planning module's link manifest (ADR 0062). The module's routes in apps/web take their paths
 * from it, and other modules, server code and end-to-end specs build the planning module's URLs
 * with it.
 */
export const planningLinks = defineModuleLinks('planning', {
  board: { path: 'board' },
  /** The order Gantt (plan 18), a page of its own beside the board (Krister, 2026-10-17). */
  gantt: { path: 'gantt' },
});
