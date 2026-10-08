// SPDX-License-Identifier: MIT
import { Global, Injectable, Module } from '@nestjs/common';
import type { GraphQLSchema } from 'graphql';

/** One module's subgraph as the in-process driver built it. */
export interface SubgraphEntry {
  /** The module's GraphQL name, which is also its root field prefix. */
  readonly name: string;
  /** The subgraph SDL with its federation link, as composition reads it. */
  readonly sdl: string;
  /** The executable subgraph schema. */
  readonly schema: GraphQLSchema;
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
