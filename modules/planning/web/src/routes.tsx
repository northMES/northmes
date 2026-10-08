// SPDX-License-Identifier: AGPL-3.0-or-later
import { linkEntry } from '@northmes/contracts';
import { planningLinks } from '@northmes/planning-contracts';
import type { PlantRoute } from '@northmes/web-sdk';
import { createRoute } from '@tanstack/react-router';

/**
 * The planning module's routes under the shell's $plant route. Each route takes its path from its
 * entry in planningLinks, so a path is written once, in the link manifest (ADR 0062). The top
 * route's path is the manifest's own, the module id.
 */
export function planningRoutes(plantRoute: PlantRoute) {
  return createRoute({
    getParentRoute: () => plantRoute,
    path: linkEntry(planningLinks).path,
  });
}
