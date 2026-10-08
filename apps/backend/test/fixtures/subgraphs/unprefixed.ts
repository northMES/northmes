// SPDX-License-Identifier: AGPL-3.0-or-later
// Fixture module gamma: its one root field lacks the module prefix, which NORTHMES_ROOT_FIELD_PREFIX
// refuses.
import { Module } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';
import { defineModule } from '@northmes/sdk';

@Resolver()
export class GammaResolver {
  @Query(() => String)
  ping(): string {
    return 'pong';
  }
}

@Module({ providers: [GammaResolver] })
export class GammaModule {}

export const gamma = defineModule({
  id: 'gamma',
  version: '0.0.0',
  northmes: '>=0.0.0-0 <0.1.0-0',
  server: async () => ({ default: GammaModule }),
});
