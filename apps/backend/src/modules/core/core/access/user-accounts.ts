// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { AuthService } from './auth.service.ts';

/** What core's user commands ask of Better Auth (ADR 0010). */
export type UserAccounts = Pick<
  AuthService,
  'createUser' | 'setPassword' | 'addToOrganization' | 'block' | 'unblock'
>;

/** What core's integration token commands ask of Better Auth's api-key plugin (ADR 0073). */
export type IntegrationKeys = Pick<AuthService, 'createIntegrationKey' | 'deleteIntegrationKey'>;

let registered: AuthService | undefined;

/**
 * The user accounts of the running app. A command handler is a plain object that Nest does not
 * build, so it cannot inject AuthService; UserAccountsRegistration registers the app's one while
 * the app runs.
 */
export function userAccounts(): UserAccounts {
  if (!registered)
    throw new Error('No app with core runs, so there are no user accounts to change');
  return registered;
}

/** The integration keys of the running app, which core's token commands create and delete. */
export function integrationKeys(): IntegrationKeys {
  if (!registered) throw new Error('No app with core runs, so there are no integration keys');
  return registered;
}

/** Registers the app's AuthService for userAccounts() and integrationKeys() while the app runs. */
@Injectable()
export class UserAccountsRegistration implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  onModuleInit(): void {
    registered = this.auth;
  }

  onModuleDestroy(): void {
    if (registered === this.auth) registered = undefined;
  }
}
