// SPDX-License-Identifier: MIT
import type { CommandContract } from '@northmes/contracts';

/** The token under which the host provides the CommandBus. Generated mutation fields inject it. */
export const COMMAND_BUS = 'northmes:command-bus';

/** A command as the bus runs it: the owner's contract and the module's server code for it. */
export interface Command<Input = unknown, Result = unknown> {
  readonly contract: CommandContract;
  /**
   * Builds the payload that the command validators get. The bus calls it for a validatable
   * command and parses its result with contract.payload (ADR 0037).
   */
  buildPayload?(input: Input): Promise<unknown>;
  /** Makes the change and returns what the mutation returns. */
  handle(input: Input): Promise<Result>;
}

/**
 * Runs every command, from every surface, through the steps of ADR 0012. The host implements it;
 * module code never calls a handler directly.
 */
export interface CommandBus {
  /** Runs `command` with an input that its contract parsed, and returns the handler's result. */
  run<Input, Result>(command: Command<Input, Result>, input: Input): Promise<Result>;
}
