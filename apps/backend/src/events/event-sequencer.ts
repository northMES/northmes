// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ServerEnv } from '@northmes/sdk/config';
import { DATABASE, type ScopedDatabase } from '@northmes/sdk/data';
import { sql } from 'kysely';
import { runAs } from '../principal.ts';

/** The most events one batch publishes (ADR 0014). */
const BATCH_SIZE = 500;

/** How long the sequencer waits between batches, in milliseconds (ADR 0014: 100 to 250 ms). */
const IDLE_MS = 200;

/**
 * Publishes the event log: every IDLE_MS it runs one batch of core.sequence_events, which gives
 * the committed events without a position theirs, in insertion order (ADR 0014). It runs in roles
 * worker and all; role api only writes events, and an app without NORTHMES_ROLE, such as the
 * CLI's, runs none. A batch that fails is logged and the next one tries again.
 */
@Injectable()
export class EventSequencer implements OnApplicationBootstrap, OnApplicationShutdown {
  readonly #logger = new Logger('EventSequencer');
  #timer: NodeJS.Timeout | undefined;
  #running: Promise<void> | undefined;
  #stopped = false;

  constructor(
    @Inject(DATABASE) private readonly database: ScopedDatabase<unknown>,
    @Optional() @Inject(ConfigService) private readonly config?: ConfigService<ServerEnv, true>,
  ) {}

  onApplicationBootstrap(): void {
    const role = this.config?.get('NORTHMES_ROLE', { infer: true }) as string | undefined;
    if (role === 'all' || role === 'worker') this.#schedule();
  }

  async onApplicationShutdown(): Promise<void> {
    this.#stopped = true;
    clearTimeout(this.#timer);
    await this.#running;
  }

  #schedule(): void {
    if (this.#stopped) return;
    this.#timer = setTimeout(() => {
      this.#running = this.#batch().finally(() => this.#schedule());
    }, IDLE_MS);
  }

  /** One batch, in a transaction without a principal: the definer function needs no scopes. */
  async #batch(): Promise<void> {
    try {
      await runAs(null, () =>
        this.database.transaction((tx) =>
          sql`select core.sequence_events(${BATCH_SIZE}::integer)`.execute(tx),
        ),
      );
    } catch (error) {
      this.#logger.error('An event log batch failed; the next batch tries again', error);
    }
  }
}
