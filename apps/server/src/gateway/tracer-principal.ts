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
 * and adds it to the gateway context as `principal`. A request without the header gets null, so it
 * reads nothing. The plant comes from the HTTP request alone: the gateway also spreads a socket's
 * connectionParams over `context.headers`, which this plugin never reads (ADR 0011, ADR 0018).
 */
export const tracerPrincipalPlugin: GatewayPlugin<{ principal: Principal | null }> = {
  onContextBuilding({ context, extendContext }) {
    const plantId = context.request.headers.get(PLANT_HEADER);
    extendContext({ principal: plantId ? tracerPrincipal(plantId) : null });
  },
};
