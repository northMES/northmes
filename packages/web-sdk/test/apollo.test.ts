// SPDX-License-Identifier: MIT
import { gql } from '@apollo/client';
import { createNorthmesClient } from '@northmes/web-sdk';
import { describe, expect, it, vi } from 'vitest';

function graphqlResponse(data: unknown): Response {
  return new Response(JSON.stringify({ data }), {
    headers: { 'content-type': 'application/graphql-response+json' },
  });
}

describe('createNorthmesClient', () => {
  it('E02-S05 createNorthmesClient sends the plant in x-northmes-plant over HTTP', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => graphqlResponse({ ping: 'pong' }));
    const client = createNorthmesClient({ plantId: 'plant-a', fetch });

    await client.query({ query: gql`query Ping { ping }` });

    expect(fetch).toHaveBeenCalledOnce();
    const init = fetch.mock.calls[0]?.[1];
    expect(new Headers(init?.headers).get('x-northmes-plant')).toBe('plant-a');
  });
});
