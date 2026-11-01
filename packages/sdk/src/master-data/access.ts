// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type { HandlerContext } from '../commands/command-bus.ts';

/** Where a request reads a register: its company, and its plant, or undefined in company settings. */
export interface MasterDataRequestScope {
  readonly companyId: string;
  readonly plantId: string | undefined;
}

/**
 * What a register's server code asks of the host about the running request (ADR 0010, ADR 0066).
 * The host knows the principal; the kit reads it only through this port, so it stays MIT.
 */
export interface MasterDataAccess<Scope extends MasterDataRequestScope = MasterDataRequestScope> {
  /**
   * The scope of the running request when its principal holds `permission` there: at the request's
   * plant, or in company settings at the company `companyId` names. It throws core.forbidden
   * otherwise.
   */
  requestScope(permission: string, companyId?: string): Scope;
  /** Runs fn with the scope sets of `scope`, so its transactions read where the scope reads. */
  readIn<Result>(scope: Scope, fn: () => Result): Result;
  /** Runs fn so that its transactions read where the request reads, in company settings too. */
  readAsRequest<Result>(fn: () => Result): Result;
  /**
   * The company a command writes at: the company of the request's plant, or in company settings
   * the one the input's companyId names. undefined when they disagree or neither names one.
   */
  requestCompany(
    input: unknown,
    context: Pick<HandlerContext, 'tx' | 'plantId'>,
  ): Promise<string | undefined>;
}
