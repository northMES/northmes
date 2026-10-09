// SPDX-License-Identifier: AGPL-3.0-or-later
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  type DynamicModule,
  Global,
  Inject,
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ServerEnv } from '@northmes/sdk/config';

/** The injection token of the web app's origins, webOrigins in northmes.config.json. */
export const WEB_ORIGINS = 'northmes.webOrigins';

/**
 * The headers a web origin may read from an answer: the bearer plugin's session token, the jwt
 * plugin's JWT (ADR 0010), and the seconds a rate-limited request waits. The web sends its
 * requests without cookies, so the rule never allows credentials.
 */
const exposedHeaders = 'set-auth-token, set-auth-jwt, x-retry-after';

/** The headers a web origin may send. */
const allowedHeaders = 'authorization, content-type, x-northmes-plant';

/** How long a browser may cache a preflight answer, in seconds. */
const preflightMaxAge = '600';

/**
 * The same-origin rule of the API (ADR 0011): a request without an Origin header, or from the
 * API's own origin, passes as it is. A request from one of the web origins passes with the CORS
 * headers that let the web read the answer, and its preflight is answered here. A request from any
 * other origin is refused with 403 before any route or GraphQL sees it.
 */
function originRule(publicOrigin: string, webOrigins: readonly string[]) {
  const allowed = new Set(webOrigins);
  return (request: IncomingMessage, response: ServerResponse, next: () => void): void => {
    const origin = request.headers.origin;
    if (origin === undefined || origin === publicOrigin) {
      next();
      return;
    }
    if (!allowed.has(origin)) {
      response.statusCode = 403;
      response.setHeader('content-type', 'application/json');
      response.end(
        JSON.stringify({ statusCode: 403, message: 'This origin may not call the API' }),
      );
      return;
    }
    response.setHeader('access-control-allow-origin', origin);
    response.setHeader('vary', 'Origin');
    response.setHeader('access-control-expose-headers', exposedHeaders);
    if (request.method === 'OPTIONS') {
      response.statusCode = 204;
      response.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
      response.setHeader('access-control-allow-headers', allowedHeaders);
      response.setHeader('access-control-max-age', preflightMaxAge);
      response.end();
      return;
    }
    next();
  };
}

/**
 * Provides the web origins under WEB_ORIGINS, which core's Better Auth trusts, and applies the
 * origin rule to every route. AppModule imports it before any module with routes, so the rule runs
 * before GraphqlModule's middleware answers /graphql.
 */
@Global()
@Module({})
export class WebOriginsModule implements NestModule {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService<ServerEnv, true>,
    @Inject(WEB_ORIGINS) private readonly webOrigins: readonly string[],
  ) {}

  static forRoot(webOrigins: readonly string[]): DynamicModule {
    return {
      module: WebOriginsModule,
      providers: [{ provide: WEB_ORIGINS, useValue: webOrigins }],
      exports: [WEB_ORIGINS],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    const publicOrigin = this.config.get('NORTHMES_PUBLIC_ORIGIN', { infer: true });
    consumer.apply(originRule(publicOrigin, this.webOrigins)).forRoutes('{*path}');
  }
}
