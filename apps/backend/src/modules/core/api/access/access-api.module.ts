// SPDX-License-Identifier: AGPL-3.0-or-later
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Inject, type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AccessModule } from '../../core/access/access.module.ts';
import { AuthService } from '../../core/access/auth.service.ts';
import { NewPasswordController } from './new-password.controller.ts';
import { PrincipalGuard } from './principal.guard.ts';

/** The paths of Better Auth's handler, /api/auth and everything below it. */
const authRoutes = ['/api/auth', '/api/auth/{*path}'];

/**
 * core's sign-in surface (ADR 0010): Better Auth's handler on /api/auth/*, which answers before any
 * route, the new password step after a sign-in with a temporary password, and PrincipalGuard on
 * every route and GraphQL field of the app.
 */
@Module({
  imports: [AccessModule],
  controllers: [NewPasswordController],
  providers: [{ provide: APP_GUARD, useClass: PrincipalGuard }],
})
export class AccessApiModule implements NestModule {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply((request: IncomingMessage, response: ServerResponse) =>
        this.auth.handle(request, response),
      )
      .forRoutes(...authRoutes);
  }
}
