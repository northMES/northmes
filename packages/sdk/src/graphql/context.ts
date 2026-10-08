// SPDX-License-Identifier: MIT

/**
 * The context every resolver receives through @Context(). The host creates one per request, and
 * one per event of a subscription, so it lives exactly as long as one request.
 */
export interface RequestContext {
  /** The request's loaders by name. Only loaderFor reads and writes it. */
  readonly loaders: Map<string, unknown>;
}
