// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from '@nestjs/common';
import { PrincipalResolver } from '../../../../principal.ts';
import { BetterAuth } from '../../infrastructure/auth/better-auth.ts';
import { AuthService } from './auth.service.ts';
import { PrincipalService } from './principal.service.ts';

/**
 * Provides sign-in and the principal: Better Auth, the AuthService on it and the PrincipalService,
 * which is also the host's PrincipalResolver. core's access surface imports it.
 */
@Module({
  providers: [
    BetterAuth,
    AuthService,
    PrincipalService,
    { provide: PrincipalResolver, useExisting: PrincipalService },
  ],
  exports: [AuthService, PrincipalService, PrincipalResolver],
})
export class AccessModule {}
