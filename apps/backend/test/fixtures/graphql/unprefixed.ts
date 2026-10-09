// SPDX-License-Identifier: AGPL-3.0-or-later
// Fixture module gamma: its one root field lacks the module prefix, which NORTHMES_ROOT_FIELD_PREFIX
// refuses.
import { Module } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';
import type { InRepoModule } from '../../../src/modules.ts';

@Resolver()
export class GammaResolver {
  @Query(() => String)
  ping(): string {
    return 'pong';
  }
}

@Module({ providers: [GammaResolver] })
export class GammaModule {}

export const gamma: InRepoModule = {
  id: 'gamma',
  module: GammaModule,
};
