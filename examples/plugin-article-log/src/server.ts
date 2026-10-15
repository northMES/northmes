// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Logger, Module } from '@nestjs/common';
import {
  articleArchived,
  articleCreated,
  articleRestored,
  articleUpdated,
} from '@northmes/core-contracts';
import { type ConsumedEvent, EventConsumer } from '@northmes/sdk/events';
import { sql, type Transaction } from 'kysely';

const logger = new Logger('ExampleArticleLog');

/** The article's code and name, which every core.article event carries. */
interface ArticleData {
  readonly code: string;
  readonly name: string;
}

/**
 * Logs one article event and keeps it in the plugin's own table, in the transaction the host
 * opened at the event's scope. The host runs this once per event, also when the job runs again.
 */
async function logEvent(event: ConsumedEvent<ArticleData>, tx: Transaction<unknown>) {
  logger.log(
    `${event.name} ${event.data.code} ${event.data.name} (version ${event.entity.version})`,
  );
  await sql`
    insert into example_article_log.entry
      (event_id, event, article_id, article_version, scope_id, code, name)
    values (${event.id}, ${event.name}, ${event.entity.id}, ${event.entity.version},
            ${event.scopeId}, ${event.data.code}, ${event.data.name})`.execute(tx);
}

/** One consumer per article event. Archiving is how NorthMES deletes an article. */
const consumers = [
  EventConsumer(articleCreated, {
    name: 'created',
    handle: (event, { tx }) => logEvent(event, tx),
  }),
  EventConsumer(articleUpdated, {
    name: 'updated',
    handle: (event, { tx }) => logEvent(event, tx),
  }),
  EventConsumer(articleArchived, {
    name: 'archived',
    handle: (event, { tx }) => logEvent(event, tx),
  }),
  EventConsumer(articleRestored, {
    name: 'restored',
    handle: (event, { tx }) => logEvent(event, tx),
  }),
];

@Module({ providers: consumers })
export class ExampleArticleLogModule {}

export default ExampleArticleLogModule;
