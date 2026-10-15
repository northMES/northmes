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
import { type Secrets, type ServerEnv, secretsConfig } from '@northmes/sdk/config';
import { DATABASE, type ScopedDatabase } from '@northmes/sdk/data';
import { sql } from 'kysely';
import { fromKysely, PgBoss } from 'pg-boss';
import { jobSchema } from '../migrate/job-queue.ts';
import { runAs } from '../principal.ts';
import { consume, consumes, type EventJob, eventJob, type PublishedEventRow } from './consume.ts';
import type { RegisteredConsumer } from './discover-consumers.ts';

/** The token of the consumers that EventsModule found, RegisteredConsumer[]. */
export const CONSUMERS = 'northmes:consumers';

/** The most events one batch publishes (ADR 0014). */
const BATCH_SIZE = 500;

/** How long the sequencer waits between batches, in milliseconds (ADR 0014: 100 to 250 ms). */
const IDLE_MS = 200;

/** How often a consumer's worker looks for a job when its queue was empty, in seconds. */
const POLL_SECONDS = 0.5;

/** The connections of pg-boss's own pool, which logs in as nm_app. */
const JOB_POOL_SIZE = 4;

/**
 * Publishes the event log and runs its consumers, in roles worker and all (ADR 0014). Every
 * IDLE_MS it runs one batch of core.publish_events, which gives the committed events without a
 * position theirs, in insertion order, and in the same transaction it queues one pg-boss job per
 * event and consumer that consumes it, so a job exists exactly when its event is published. One
 * pg-boss worker per consumer runs the jobs (consume). Role api only writes events, and an app
 * without NORTHMES_ROLE, such as the CLI's, runs none of this. A batch that fails is logged and
 * the next one tries again.
 *
 * pg-boss logs in as nm_app with migrate false, so only northmes migrate changes its schema, and
 * without reindex, which needs the tables' owner. A consumer's queue is a row in pgboss.queue,
 * which start adds when it is missing.
 */
@Injectable()
export class EventSequencer implements OnApplicationBootstrap, OnApplicationShutdown {
  readonly #logger = new Logger('EventSequencer');
  #boss: PgBoss | undefined;
  #timer: NodeJS.Timeout | undefined;
  #running: Promise<void> | undefined;
  #stopped = false;

  constructor(
    @Inject(DATABASE) private readonly database: ScopedDatabase<unknown>,
    @Inject(CONSUMERS) private readonly consumers: readonly RegisteredConsumer[],
    @Optional() @Inject(ConfigService) private readonly config?: ConfigService<ServerEnv, true>,
    @Optional() @Inject(secretsConfig.KEY) private readonly secrets?: Secrets,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const role = this.config?.get('NORTHMES_ROLE', { infer: true }) as string | undefined;
    if (role !== 'all' && role !== 'worker') return;
    if (this.consumers.length > 0) await this.#startWorkers();
    this.#schedule();
  }

  async onApplicationShutdown(): Promise<void> {
    this.#stopped = true;
    clearTimeout(this.#timer);
    await this.#running;
    await this.#boss?.stop({ graceful: true });
  }

  /** Starts pg-boss as nm_app, adds each consumer's queue and runs one worker per consumer. */
  async #startWorkers(): Promise<void> {
    const url = new URL(this.config?.get('DATABASE_URL', { infer: true }) ?? '');
    url.username = 'nm_app';
    url.password = this.secrets?.NORTHMES_DB_APP_PASSWORD ?? '';
    const boss = new PgBoss({
      connectionString: url.href,
      schema: jobSchema,
      migrate: false,
      reindex: false,
      schedule: false,
      max: JOB_POOL_SIZE,
    });
    // pg-boss reports failures of its own loops here; without a listener they would end the process.
    boss.on('error', (error) => this.#logger.error('The job runner reported an error', error));
    await boss.start();
    this.#boss = boss;
    for (const registered of this.consumers) {
      await boss.createQueue(registered.queue);
      await boss.work<EventJob>(
        registered.queue,
        { pollingIntervalSeconds: POLL_SECONDS },
        async (jobs) => {
          for (const job of jobs) await consume(this.database, registered, job.data);
        },
      );
    }
  }

  #schedule(): void {
    if (this.#stopped) return;
    this.#timer = setTimeout(() => {
      this.#running = this.#batch().finally(() => this.#schedule());
    }, IDLE_MS);
  }

  /**
   * One batch, in a transaction without a principal: the definer function needs no scopes, and
   * pg-boss's tables have no policy. The jobs join the batch's transaction.
   */
  async #batch(): Promise<void> {
    try {
      await runAs(null, () =>
        this.database.transaction(async (tx) => {
          const { rows } = await sql<PublishedEventRow>`
            select * from core.publish_events(${BATCH_SIZE}::integer)`.execute(tx);
          const boss = this.#boss;
          if (!boss) return;
          const events = rows.map(eventJob);
          for (const registered of this.consumers) {
            const jobs = events
              .filter((event) => consumes(registered, event))
              .map((data) => ({ data }));
            if (jobs.length > 0) await boss.insert(registered.queue, jobs, { db: fromKysely(tx) });
          }
        }),
      );
    } catch (error) {
      this.#logger.error('An event log batch failed; the next batch tries again', error);
    }
  }
}
