// SPDX-License-Identifier: MIT
import type { CommandContract } from '@northmes/contracts';
import type { Transaction } from 'kysely';

/** The token under which the host provides the CommandBus. Generated mutation fields inject it. */
export const COMMAND_BUS = 'northmes:command-bus';

/**
 * What the bus hands a command's server code: the transaction it opened for this run of the
 * command, in which the validators run too (ADR 0012), and the target the bus loaded for a command
 * on an existing entity.
 */
export interface HandlerContext<Target = unknown> {
  readonly tx: Transaction<unknown>;
  /** The row that target.load returned, or undefined for a command without a target. */
  readonly target: Target;
}

/** What the bus reads of a command's target: the version the command's change is checked on. */
export interface Versioned {
  readonly version: number;
}

/**
 * The entity a command on an existing entity changes (contract target existing). The bus loads it
 * before the validators and the handler run, and refuses the command with core.not_found when
 * load finds no row, or with core.version_conflict when the row's version is not the input's
 * expectedVersion (ADR 0012 steps 3 and 5).
 */
export interface CommandTarget<Target> {
  /** The entity's name in the messages of those errors, such as Article. */
  readonly entity: string;
  /**
   * Reads the row with this id and locks it until the command's transaction ends, so the version
   * check, the validators and the handler judge the same row. undefined when no row with the id
   * is at the principal's scopes.
   */
  load(id: string, context: Pick<HandlerContext, 'tx'>): Promise<Target | undefined>;
}

/** A command as the bus runs it: the owner's contract and the module's server code for it. */
export interface Command<
  Input = unknown,
  Result = unknown,
  Target extends Versioned | undefined = Versioned | undefined,
> {
  readonly contract: CommandContract;
  /** The entity the command changes, for a contract with target existing. */
  readonly target?: CommandTarget<Target>;
  /**
   * Builds the payload that the command validators get. The bus calls it for a validatable
   * command and parses its result with each validator's copy of contract.payload (ADR 0037).
   */
  buildPayload?(input: Input, context: HandlerContext<Target>): Promise<unknown>;
  /** Makes the change with an input the contract parsed, and returns the mutation's result. */
  handle(input: Input, context: HandlerContext<Target>): Promise<Result>;
}

/**
 * Runs every command, from every surface, through the steps of ADR 0012. The host implements it;
 * module code never calls a handler directly.
 */
export interface CommandBus {
  /** Runs `command` with an input that its contract parsed, and returns the handler's result. */
  run<Input, Result, Target extends Versioned | undefined>(
    command: Command<Input, Result, Target>,
    input: Input,
  ): Promise<Result>;
}
