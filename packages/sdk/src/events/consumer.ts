// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type { Type } from '@nestjs/common';
import type { EventContract } from '@northmes/contracts';
import type { Transaction } from 'kysely';
import type { z } from 'zod';

/** A published event as a consumer gets it (ADR 0014). */
export interface ConsumedEvent<Data = unknown> {
  /** The event's public id, a uuidv7. */
  readonly id: string;
  /** Its name, such as core.article.created. */
  readonly name: string;
  /** The schema version of data, the version the consumer's contract names. */
  readonly schemaVersion: number;
  /** The entity the event is about, with its version after the change. */
  readonly entity: { readonly type: string; readonly id: string; readonly version: number };
  /** The scope the change was made at, where the consumer's transaction reads and writes. */
  readonly scopeId: string;
  /** Its position in the event log, as a decimal string: the cursor every reader pages by. */
  readonly position: string;
  /** What the event carries, parsed with the consumer's copy of the contract. */
  readonly data: Data;
}

/** What the host hands a consumer for one event. */
export interface ConsumerContext {
  /**
   * The transaction the host opened for this event, whose read and write scopes are the event's
   * scope. The host records the event in core.inbox in it first, so the consumer's writes commit
   * exactly once per event, also when the job is delivered again (ADR 0014).
   */
  readonly tx: Transaction<unknown>;
}

/** An event consumer: code that runs after an event's command commits, at least once. */
export interface Consumer<Data extends z.ZodType = z.ZodType> {
  /**
   * The consuming module's copy of the owner's event contract, from the contracts package it
   * bundled. The consumer gets events of this name and this schema version only.
   */
  readonly event: EventContract<Data>;
  /**
   * kebab-case, unique among the module's consumers. The host names the consumer's job queue
   * `<module id>.<name>`.
   */
  readonly name: string;
  /**
   * Handles one event. A throw rolls the consumer's transaction back, and the job runner tries the
   * event again later; the command that wrote the event stands.
   */
  handle(event: ConsumedEvent<z.output<Data>>, context: ConsumerContext): Promise<void>;
}

/** What EventConsumer returns: a provider for the consuming module's Nest module. */
export type EventConsumerProvider<Data extends z.ZodType = z.ZodType> = Type & {
  /** The consumer the host finds among the module's providers. */
  readonly consumer: Consumer<Data>;
};

/**
 * Registers an event consumer. Listed in the providers of the Nest module that the consuming
 * module's server entry exports, it lets the module react to `event` after the command that
 * published it commits (ADR 0014, ADR 0068).
 */
export function EventConsumer<Data extends z.ZodType>(
  event: EventContract<Data>,
  options: Omit<Consumer<Data>, 'event'>,
): EventConsumerProvider<Data> {
  const consumer: Consumer<Data> = { event, ...options };
  return Object.assign(class {}, { consumer });
}
