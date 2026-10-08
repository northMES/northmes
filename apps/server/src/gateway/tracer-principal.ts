// SPDX-License-Identifier: AGPL-3.0-or-later
import type { GatewayPlugin } from '@graphql-hive/gateway-runtime';
import type { Principal } from '../principal.ts';

/** The header that names a request's plant by its scope id, until plant slugs arrive (E05-S03). */
export const PLANT_HEADER = 'x-northmes-plant';

/**
 * The principal of a request at a plant until sign-in, roles and the plant check exist (E05-S03 to
 * E05-S06): it holds every permission, and both of its scope sets hold the plant alone.
 */
export function tracerPrincipal(plantId: string): Principal {
  return {
    plantId,
    readScopes: [plantId],
    writeScopes: [plantId],
    can: () => true,
  };
}

/**
 * Resolves the principal once per client request from the plant in its x-northmes-plant header,
 * and adds it to the gateway context as `principal`.
 */
export const tracerPrincipalPlugin: GatewayPlugin<{ principal: Principal }> = {
  onContextBuilding({ context, extendContext }) {
    const plantId = context.request.headers.get(PLANT_HEADER) as string;
    extendContext({ principal: tracerPrincipal(plantId) });
  },
};
