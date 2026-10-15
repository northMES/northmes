// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject, Module, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost } from '@nestjs/core';
import type { ServerEnv } from '@northmes/sdk/config';

/**
 * Sets Express's trust proxy to NORTHMES_TRUSTED_PROXY_HOPS, so req.ip is the client's address:
 * the X-Forwarded-For entry that the outermost trusted proxy wrote, or the connection's address
 * when no proxy is trusted (#476). Better Auth's sign-in throttle and the GraphQL rate limit both
 * count a request against that address. pnpm northmes migrate serves nothing and has no such key.
 */
@Module({})
export class TrustedProxyModule implements OnModuleInit {
  constructor(
    @Inject(HttpAdapterHost) private readonly adapterHost: HttpAdapterHost,
    @Inject(ConfigService) private readonly config: ConfigService<ServerEnv, true>,
  ) {}

  onModuleInit(): void {
    const hops = this.config.get('NORTHMES_TRUSTED_PROXY_HOPS', { infer: true }) ?? 0;
    this.adapterHost.httpAdapter?.getInstance()?.set?.('trust proxy', hops);
  }
}
