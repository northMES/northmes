// SPDX-License-Identifier: MIT
// Server-only: subgraphs, entity references and request loaders for module GraphQL code.
export { type DefineSubgraphOptions, defineSubgraph } from './define-subgraph.ts';
export { InProcessSubgraphDriver, type InProcessSubgraphOptions } from './driver.ts';
export { type SubgraphEntry, SubgraphRegistry, SubgraphRegistryModule } from './registry.ts';
