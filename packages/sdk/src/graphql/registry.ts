// SPDX-License-Identifier: MIT
import { Global, Injectable, Module } from '@nestjs/common';
import type { GraphQLSchema } from 'graphql';

/** One module's subgraph as the in-process driver built it. */
export interface SubgraphEntry {
  /** The module's GraphQL name, which is also its root field prefix. */
  readonly name: string;
  /** The subgraph SDL composition reads, with its federation link, in lexicographic order. */
  readonly sdl: string;
  /** The executable subgraph schema. */
  readonly schema: GraphQLSchema;
  /**
   * The entities of other modules that the module references through entityRef, which the
   * composition rules tell apart from the entities it owns.
   */
  readonly entityRefs: readonly string[];
}

/** Collects the subgraph of every module that defineSubgraph built in this process. */
@Injectable()
export class SubgraphRegistry {
  readonly #entries: SubgraphEntry[] = [];

  add(entry: SubgraphEntry): void {
    this.#entries.push(entry);
  }

  all(): readonly SubgraphEntry[] {
    return [...this.#entries];
  }
}

/** Imported once by the host, so every subgraph's driver and the gateway share one registry. */
@Global()
@Module({ providers: [SubgraphRegistry], exports: [SubgraphRegistry] })
export class SubgraphRegistryModule {}
