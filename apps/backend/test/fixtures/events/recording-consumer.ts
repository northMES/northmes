// SPDX-License-Identifier: AGPL-3.0-or-later
// A fixture plugin whose consumer records each core.article.created event it gets, and whether
// its transaction reads the event's row, which only a transaction at the event's scope does.
import { Module } from '@nestjs/common';
import { articleCreated } from '@northmes/core-contracts';
import { type ConsumedEvent, EventConsumer } from '@northmes/sdk/events';
import { sql } from 'kysely';
import type { ServerEntry } from '../../../src/app.module.ts';

export interface Recorded {
  readonly event: ConsumedEvent;
  /** How many rows of core.event with the event's id the consumer's transaction read. */
  readonly readsEvent: number;
}

/** What the consumer recorded, in the order it ran. A test empties it. */
export const recorded: Recorded[] = [];

export const RecordCreated = EventConsumer(articleCreated, {
  name: 'record-created',
  async handle(event, { tx }) {
    const { rows } = await sql`select id from core.event where id = ${event.id}`.execute(tx);
    recorded.push({ event, readsEvent: rows.length });
  },
});

@Module({ providers: [RecordCreated] })
class RecorderModule {}

export const recorder: ServerEntry = {
  id: 'recorder',
  module: RecorderModule,
  dependsOn: ['core'],
};
