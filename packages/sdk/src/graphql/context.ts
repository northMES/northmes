// SPDX-License-Identifier: MIT

/**
 * The context every resolver of a subgraph receives through @Context(). The gateway creates one
 * per client request and subgraph, so it lives exactly as long as one request.
 */
export interface SubgraphContext {
  /** The request's loaders by name. Only loaderFor reads and writes it. */
  readonly loaders: Map<string, unknown>;
}
