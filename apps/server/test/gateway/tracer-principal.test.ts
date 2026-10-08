// SPDX-License-Identifier: AGPL-3.0-or-later
import type { GatewayPlugin } from '@graphql-hive/gateway-runtime';
import { given } from '@northmes/testing';
import { describe, expect, it, vi } from 'vitest';
import { tracerPrincipalPlugin } from '../../src/gateway/tracer-principal.ts';

type ContextBuilding = Parameters<NonNullable<GatewayPlugin['onContextBuilding']>>[0];

/**
 * Calls the plugin's context hook as the gateway does for a request with these headers, and
 * returns what the hook adds to the context.
 */
function contextExtensionFor(headers: Readonly<Record<string, string>>) {
  const extendContext = vi.fn();
  const request = new Request('http://127.0.0.1:4100/graphql', { method: 'POST', headers });
  void tracerPrincipalPlugin.onContextBuilding?.({
    context: { request },
    extendContext,
    breakContextBuilding: () => {},
  } as unknown as ContextBuilding);
  expect(extendContext).toHaveBeenCalledOnce();
  return extendContext.mock.calls[0]?.[0];
}

describe('the tracer principal plugin', () => {
  it('E02-S04 a request with x-northmes-plant gets that plant and every permission', () => {
    const plant = given.plant();

    const { principal } = contextExtensionFor({ 'x-northmes-plant': plant });

    expect(principal).toMatchObject({ plantId: plant, readScopes: [plant], writeScopes: [plant] });
    // Permission names are <module>.<entity>:<action> (ADR 0010); the tracer principal holds any.
    expect(principal.can('planning.productionOrder:release')).toBe(true);
    expect(principal.can('core.article:read')).toBe(true);
  });
});
