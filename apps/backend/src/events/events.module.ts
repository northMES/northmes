// SPDX-License-Identifier: AGPL-3.0-or-later
import { type DynamicModule, Module } from '@nestjs/common';
import type { ValidatorScope } from '../commands/discover-validators.ts';
import type { DatabaseMode } from '../db/database.module.ts';
import { discoverConsumers } from './discover-consumers.ts';
import { CONSUMERS, EventSequencer } from './event-sequencer.ts';

/** The event sequencer and the consumers it runs (ADR 0014). */
@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: Nest knows a module by its decorated class.
export class EventsModule {
  /**
   * `servers` are the catalog's modules and plugins with a Nest module. forRoot finds their
   * consumers before Nest builds any provider, so a BootError from discoverConsumers reaches the
   * caller of AppModule.forRoot. pnpm northmes migrate has no pool (database 'none'), so it
   * publishes no events and runs no consumer.
   */
  static forRoot(servers: readonly ValidatorScope[], database: DatabaseMode): DynamicModule {
    const consumers = discoverConsumers(servers);
    return {
      module: EventsModule,
      providers:
        database === 'app' ? [{ provide: CONSUMERS, useValue: consumers }, EventSequencer] : [],
    };
  }
}
