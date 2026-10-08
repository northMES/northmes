// SPDX-License-Identifier: MIT
// Server-only: subgraphs, entity references and request loaders for module GraphQL code.
export type { SubgraphContext } from './context.ts';
export { type DefineSubgraphOptions, defineSubgraph } from './define-subgraph.ts';
export { InProcessSubgraphDriver, type InProcessSubgraphOptions } from './driver.ts';
export { type EntityReference, type GraphqlKit, graphqlKit } from './entity-ref.ts';
export { type BatchLoad, type Loader, loaderFor } from './loader.ts';
export { type SubgraphEntry, SubgraphRegistry, SubgraphRegistryModule } from './registry.ts';
