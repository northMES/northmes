// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type { ScopedDatabase } from '@northmes/sdk/data';
import type { ConsumedEvent } from '@northmes/sdk/events';
import { sql } from 'kysely';
import { type Principal, runAs } from '../principal.ts';
import type { RegisteredConsumer } from './discover-consumers.ts';

/** A published event as core.publish_events returns it. */
export interface PublishedEventRow {
  readonly id: string;
  readonly event: string;
  readonly schema_version: number;
  readonly entity_type: string;
  readonly entity_id: string;
  /** bigint, which pg returns as a string. */
  readonly entity_version: string;
  readonly scope_id: string;
  readonly data: unknown;
  /** bigint, which pg returns as a string. */
  readonly position: string;
}

/** The payload of a consumer's job: the event, with its data as the log holds it. */
export type EventJob = ConsumedEvent<unknown>;

/** The job payload of a published event. */
export function eventJob(row: PublishedEventRow): EventJob {
  return {
    id: row.id,
    name: row.event,
    schemaVersion: row.schema_version,
    entity: { type: row.entity_type, id: row.entity_id, version: Number(row.entity_version) },
    scopeId: row.scope_id,
    position: String(row.position),
    data: row.data,
  };
}

/**
 * Whether `consumer` gets `event`: its contract names the event's name and schema version. An
 * event of another version reaches no consumer, so no consumer meets a shape it was not built for
 * (ADR 0014).
 */
export function consumes({ consumer }: RegisteredConsumer, event: EventJob): boolean {
  return consumer.event.name === event.name && consumer.event.version === event.schemaVersion;
}

/**
 * The principal a consumer runs as: it reads and writes at the event's scope only, holds no
 * permission and is no user.
 */
function consumerPrincipal(scopeId: string): Principal {
  return {
    userId: '',
    plantId: undefined,
    readScopes: [scopeId],
    writeScopes: [scopeId],
    scopes: new Map(),
  };
}

/**
 * Runs one consumer on one event in one transaction at the event's scope. The transaction first
 * records the event in core.inbox under the consumer's queue name; when the row is there already,
 * the consumer has handled the event and nothing runs (ADR 0014). The consumer's copy of the
 * contract parses the data. A throw rolls back the inbox row and the consumer's writes together.
 */
export async function consume(
  database: ScopedDatabase<unknown>,
  { queue, consumer }: RegisteredConsumer,
  event: EventJob,
): Promise<void> {
  await runAs(consumerPrincipal(event.scopeId), () =>
    database.transaction(async (tx) => {
      const { rows } = await sql`
        insert into core.inbox (consumer, event_id, scope_id)
        values (${queue}, ${event.id}, ${event.scopeId})
        on conflict do nothing
        returning event_id`.execute(tx);
      if (rows.length === 0) return;
      await consumer.handle({ ...event, data: consumer.event.data.parse(event.data) }, { tx });
    }),
  );
}
