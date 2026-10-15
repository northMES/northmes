// SPDX-License-Identifier: AGPL-3.0-or-later
// Fixture modules with consumers of core's article events.
import { Module } from '@nestjs/common';
import { articleCreated, articleUpdated } from '@northmes/core-contracts';
import { EventConsumer } from '@northmes/sdk/events';

export const TallyCreated = EventConsumer(articleCreated, {
  name: 'tally-created',
  async handle() {},
});

export const TallyUpdated = EventConsumer(articleUpdated, {
  name: 'tally-updated',
  async handle() {},
});

@Module({ providers: [TallyCreated] })
class TallyCreatedModule {}

/** Lists one consumer directly and one through a Nest module it imports. */
@Module({ imports: [TallyCreatedModule], providers: [TallyUpdated] })
export class TallyModule {}

export const tally = { id: 'article-tally', dependsOn: ['core'], module: TallyModule };

export const BadlyNamed = EventConsumer(articleCreated, {
  name: 'Tally Created',
  async handle() {},
});
export const Twin = EventConsumer(articleCreated, { name: 'tally-created', async handle() {} });

@Module({ providers: [TallyCreated, Twin, BadlyNamed] })
class MisnamedModule {}

export const misnamed = { id: 'misnamed', dependsOn: ['core'], module: MisnamedModule };
