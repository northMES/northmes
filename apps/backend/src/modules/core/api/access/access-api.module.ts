// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  Inject,
  type MiddlewareConsumer,
  Module,
  type NestModule,
  RequestMethod,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { BROWSER_ONLY, type NodeMiddleware } from '../../../../http/web-origins.module.ts';
import { AccessModule } from '../../core/access/access.module.ts';
import { AuthService } from '../../core/access/auth.service.ts';
import { NEW_PASSWORD_PATH, NewPasswordController } from './new-password.controller.ts';
import { PrincipalGuard } from './principal.guard.ts';

/** The paths of Better Auth's handler, /api/auth and everything below it. */
const authRoutes = ['/api/auth', '/api/auth/{*path}'];

/**
 * core's sign-in surface (ADR 0010): Better Auth's handler on /api/auth/*, which answers before any
 * route, the new password step after a sign-in with a temporary password, and PrincipalGuard on
 * every route and GraphQL field of the app. The browser rule runs before both (ADR 0011): password
 * sign-in needs a browser, since NorthMES supports no script or outside system that signs in with
 * a person's email and password, so every POST to them needs a NorthMES web origin.
 */
@Module({
  imports: [AccessModule],
  controllers: [NewPasswordController],
  providers: [{ provide: APP_GUARD, useClass: PrincipalGuard }],
})
export class AccessApiModule implements NestModule {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(BROWSER_ONLY) private readonly browserOnly: NodeMiddleware,
  ) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(this.browserOnly)
      .forRoutes(...authRoutes, { path: NEW_PASSWORD_PATH, method: RequestMethod.POST });
    consumer
      .apply((request: IncomingMessage, response: ServerResponse) =>
        this.auth.handle(request, response),
      )
      .forRoutes(...authRoutes);
  }
}
