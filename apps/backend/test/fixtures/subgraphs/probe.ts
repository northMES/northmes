// SPDX-License-Identifier: AGPL-3.0-or-later
// Fixture module probe: sends one query to /graphql while Nest initializes the modules, which is
// before any onApplicationBootstrap hook and so before the gateway composes the supergraph.
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Inject, Injectable, Module, type OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { defineModule } from '@northmes/sdk';
import { type GqlAnswer, gqlClient } from '@northmes/testing';

@Injectable()
export class EarlyQuery implements OnModuleInit {
  /** What /graphql answered during module init. */
  readonly answers: GqlAnswer[] = [];

  constructor(@Inject(HttpAdapterHost) private readonly adapterHost: HttpAdapterHost) {}

  async onModuleInit(): Promise<void> {
    // The server listens only after init, so the probe serves the app's request handler, with its
    // middleware already registered, on a port of its own.
    const server = createServer(this.adapterHost.httpAdapter.getInstance());
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    this.answers.push(await gqlClient(`http://127.0.0.1:${port}`).send('{ __typename }'));
    await new Promise((resolve) => server.close(resolve));
  }
}

@Module({ providers: [EarlyQuery] })
export class ProbeModule {}

export const probe = defineModule({
  id: 'probe',
  version: '0.0.0',
  northmes: '>=0.0.0-0 <0.1.0-0',
  server: async () => ({ default: ProbeModule }),
});
