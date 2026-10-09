// SPDX-License-Identifier: MIT
import { Injectable, type Type } from '@nestjs/common';
import type { ReturnTypeFunc } from '@nestjs/graphql';
import type { CommandContract } from '@northmes/contracts';
import type { z } from 'zod';
import type { Command, TargetRow } from './command-bus.ts';
import { mutationResolver } from './mutation-field.ts';

/** The server code of a command, in the owning module's AGPL server code. */
export interface CommandDefinition<Input, Result, Target extends TargetRow | undefined>
  extends Pick<Command<Input, Result, Target>, 'target' | 'scope' | 'buildPayload' | 'handle'> {
  /** The GraphQL type of the handler's result, which the mutation returns. */
  readonly returns: ReturnTypeFunc;
  /**
   * Marks the mutation plant-free, so company settings may send it without x-northmes-plant
   * (ADR 0066). The command then finds its company in its input or its target row.
   */
  readonly plantFree?: true;
}

/** What defineCommand returns: a provider for the module's Nest module. */
export type CommandProvider<
  Input,
  Result,
  Target extends TargetRow | undefined = TargetRow | undefined,
> = Type & {
  /** The command the generated mutation field sends to the bus. */
  readonly command: Command<Input, Result, Target>;
};

/** The input of a command once its contract parsed it. */
type ParsedInput<Contract extends CommandContract> = z.output<Contract['input']>;

/** The server code of a command that registerCommand registers, without a GraphQL field. */
export type RegisteredCommandDefinition<Input, Result, Target extends TargetRow | undefined> = Pick<
  Command<Input, Result, Target>,
  'target' | 'scope' | 'buildPayload' | 'handle'
>;

/**
 * The command of a contract and its server code. A command on an existing entity without a
 * target or with a scope hook throws.
 */
function commandOf<Contract extends CommandContract, Result, Target extends TargetRow | undefined>(
  contract: Contract,
  {
    target,
    scope,
    buildPayload,
    handle,
  }: RegisteredCommandDefinition<ParsedInput<Contract>, Result, Target>,
): Command<ParsedInput<Contract>, Result, Target> {
  if (contract.target === 'existing' && !target) {
    throw new Error(
      `Command ${contract.name} changes an existing entity, so its definition needs target, which the command bus loads to check expectedVersion (ADR 0012)`,
    );
  }
  if (contract.target === 'existing' && scope) {
    throw new Error(
      `Command ${contract.name} changes an existing entity, whose row names the scope the bus checks its permission at, so its definition takes no scope (ADR 0012)`,
    );
  }
  return { contract, target, scope, buildPayload, handle };
}

/**
 * Registers a command's server code. Listed in the providers of the module's Nest module, it adds
 * the command's prefixed Mutation field to the schema, so the module writes no resolver for it
 * (ADR 0012). A command on an existing entity without a target or with a scope hook, and a
 * contract field the generated input cannot carry, throw here.
 */
export function defineCommand<
  Contract extends CommandContract,
  Result,
  Target extends TargetRow | undefined = undefined,
>(
  contract: Contract,
  { returns, plantFree, ...definition }: CommandDefinition<ParsedInput<Contract>, Result, Target>,
): CommandProvider<ParsedInput<Contract>, Result, Target> {
  const command = commandOf(contract, definition);
  return Object.assign(mutationResolver(command, returns, { plantFree }), { command });
}

/**
 * Registers a command's server code without a GraphQL field (ADR 0073). Listed in the providers of
 * the module's Nest module, it gives boot the command to check, and the module's service sends
 * `command` to the bus from the method that every surface calls, such as the module's own thin
 * mutation resolver. A command on an existing entity without a target or with a scope hook throws
 * here.
 */
export function registerCommand<
  Contract extends CommandContract,
  Result,
  Target extends TargetRow | undefined = undefined,
>(
  contract: Contract,
  definition: RegisteredCommandDefinition<ParsedInput<Contract>, Result, Target>,
): CommandProvider<ParsedInput<Contract>, Result, Target> {
  const command = commandOf(contract, definition);
  @Injectable()
  class RegisteredCommand {}
  // Nest's messages name the class, so it carries the command's name.
  Object.defineProperty(RegisteredCommand, 'name', { value: `${contract.name}Command` });
  return Object.assign(RegisteredCommand, { command });
}
