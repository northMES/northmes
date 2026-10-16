// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// Server-only: consumers of the events that commands publish (ADR 0014).
export {
  type ConsumedEvent,
  type Consumer,
  type ConsumerContext,
  EventConsumer,
  type EventConsumerProvider,
} from './consumer.ts';
