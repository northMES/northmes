// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  type DynamicModule,
  Global,
  Inject,
  Logger,
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ServerEnv } from '@northmes/sdk/config';

/** The injection token of the web app's origins, webOrigins in northmes.config.json. */
export const WEB_ORIGINS = 'northmes.webOrigins';

/** The injection token of the browser rule, the middleware of the routes only a browser calls. */
export const BROWSER_ONLY = 'northmes.browserOnly';

/** A Node middleware, as Nest's MiddlewareConsumer applies it. */
export type NodeMiddleware = (
  request: IncomingMessage,
  response: ServerResponse,
  next: () => void,
) => void;

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

/** The log of refused requests, one warning with the correlation id each. */
const logger = new Logger('WebOrigins');

/**
 * Answers 403 with the masked error shape of the API: the code, a message without details and the
 * request's correlation id, which the server's log line names too.
 */
function refuse(
  request: IncomingMessage & { originalUrl?: string },
  response: ServerResponse,
  errorCode: 'core.origin_forbidden' | 'core.origin_required',
  message: string,
): void {
  const correlationId = randomUUID();
  // Express gives a middleware the URL below the path it is mounted on; originalUrl is the whole.
  const path = (request.originalUrl ?? request.url ?? '').split('?')[0];
  logger.warn(
    `Refused ${request.method} ${path} with ${errorCode}, correlation id ${correlationId}`,
  );
  response.statusCode = 403;
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify({ statusCode: 403, errorCode, message, correlationId }));
}

/**
 * The same-origin rule of the API (ADR 0011): a request without an Origin header, or from the
 * API's own origin, passes as it is. A request from one of the web origins passes with the CORS
 * headers that let the web read the answer, and its preflight is answered here. A request from any
 * other origin is refused with 403 and core.origin_forbidden before any route or GraphQL sees it.
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
      refuse(request, response, 'core.origin_forbidden', 'This origin may not call the API');
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
 * The browser rule (ADR 0011): a route that takes a password or starts or ends a session answers
 * only the web app in a browser. Browsers send Origin on every POST, also from the page's own
 * origin (Fetch standard), so a POST passes only with NORTHMES_PUBLIC_ORIGIN or a web origin as its
 * Origin; a script or outside system that sends none gets 403 with core.origin_required before
 * the route reads the body. Browsers send no Origin on a GET from the page's own origin, so a GET
 * without one passes unless its Sec-Fetch-Site says cross-site, which a browser sends on a request
 * that another site's page started. The origin rule runs first and refuses any other origin.
 */
function browserRule(publicOrigin: string, webOrigins: readonly string[]): NodeMiddleware {
  const allowed = new Set([publicOrigin, ...webOrigins]);
  return (request, response, next) => {
    const origin = request.headers.origin;
    if (origin !== undefined) {
      if (allowed.has(origin)) next();
      else refuse(request, response, 'core.origin_forbidden', 'This origin may not call the API');
      return;
    }
    const read = request.method === 'GET' || request.method === 'HEAD';
    if (read && request.headers['sec-fetch-site'] !== 'cross-site') {
      next();
      return;
    }
    refuse(request, response, 'core.origin_required', 'Sign in from the NorthMES web app');
  };
}

/**
 * Provides the web origins under WEB_ORIGINS, which core's Better Auth trusts, and the browser rule
 * under BROWSER_ONLY, which core applies to its sign-in routes, and applies the origin rule to
 * every route. AppModule imports it before any module with routes, so the rule runs
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
      providers: [
        { provide: WEB_ORIGINS, useValue: webOrigins },
        {
          provide: BROWSER_ONLY,
          inject: [ConfigService],
          useFactory: (config: ConfigService<ServerEnv, true>) =>
            browserRule(config.get('NORTHMES_PUBLIC_ORIGIN', { infer: true }), webOrigins),
        },
      ],
      exports: [WEB_ORIGINS, BROWSER_ONLY],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    const publicOrigin = this.config.get('NORTHMES_PUBLIC_ORIGIN', { infer: true });
    consumer.apply(originRule(publicOrigin, this.webOrigins)).forRoutes('{*path}');
  }
}
