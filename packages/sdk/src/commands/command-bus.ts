// SPDX-License-Identifier: MIT
import type { CommandContract } from '@northmes/contracts';
import type { Transaction } from 'kysely';

/** The token under which the host provides the CommandBus. Generated mutation fields inject it. */
export const COMMAND_BUS = 'northmes:command-bus';

/**
 * What the bus hands a command's server code: the transaction it opened for this run of the
 * command, in which the validators run too (ADR 0012).
 */
export interface HandlerContext {
  readonly tx: Transaction<unknown>;
}

/** A command as the bus runs it: the owner's contract and the module's server code for it. */
export interface Command<Input = unknown, Result = unknown> {
  readonly contract: CommandContract;
  /**
   * Builds the payload that the command validators get. The bus calls it for a validatable
   * command and parses its result with each validator's copy of contract.payload (ADR 0037).
   */
  buildPayload?(input: Input, context: HandlerContext): Promise<unknown>;
  /** Makes the change with an input the contract parsed, and returns the mutation's result. */
  handle(input: Input, context: HandlerContext): Promise<Result>;
}

/**
 * Runs every command, from every surface, through the steps of ADR 0012. The host implements it;
 * module code never calls a handler directly.
 */
export interface CommandBus {
  /** Runs `command` with an input that its contract parsed, and returns the handler's result. */
  run<Input, Result>(command: Command<Input, Result>, input: Input): Promise<Result>;
}
