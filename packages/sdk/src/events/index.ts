// SPDX-License-Identifier: MIT
// Server-only: consumers of the events that commands publish (ADR 0014).
export {
  type ConsumedEvent,
  type Consumer,
  type ConsumerContext,
  EventConsumer,
  type EventConsumerProvider,
} from './consumer.ts';
