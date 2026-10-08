// SPDX-License-Identifier: AGPL-3.0-or-later
import type { SubgraphEntry } from '@northmes/sdk/graphql';
import { composeServices, compositionHasErrors } from '@theguild/federation-composition';
import { parse } from 'graphql';

/** The URL of a subgraph in the supergraph. The in-process transport executes it in this process. */
export function inProcessUrl(name: string): string {
  return `inproc://${name}`;
}

/**
 * Composes the subgraphs into the supergraph SDL with @theguild/federation-composition (ADR 0015).
 * Throws one Error that lists every composition error.
 */
export function composeSupergraph(subgraphs: readonly SubgraphEntry[]): string {
  const result = composeServices(
    subgraphs.map(({ name, sdl }) => ({ name, typeDefs: parse(sdl), url: inProcessUrl(name) })),
  );
  if (compositionHasErrors(result)) {
    const lines = result.errors.map((error) => `- ${error.message}`);
    throw new Error(['Supergraph composition failed', ...lines].join('\n'));
  }
  return result.supergraphSdl;
}
