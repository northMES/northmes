// SPDX-License-Identifier: MIT
import type { Type } from '@nestjs/common';
import type { ReturnTypeFunc } from '@nestjs/graphql';
import type { CommandContract } from '@northmes/contracts';
import type { z } from 'zod';
import type { Command, TargetRow } from './command-bus.ts';
import { mutationResolver } from './mutation-field.ts';

/** The server code of a command, in the owning module's AGPL server code. */
export interface CommandDefinition<Input, Result, Target extends TargetRow | undefined>
  extends Pick<Command<Input, Result, Target>, 'target' | 'buildPayload' | 'handle'> {
  /** The GraphQL type of the handler's result, which the mutation returns. */
  readonly returns: ReturnTypeFunc;
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

/**
 * Registers a command's server code. Listed in the providers of the module's Nest module, it adds
 * the command's prefixed Mutation field to the schema, so the module writes no resolver for it
 * (ADR 0012). A command on an existing entity without a target, and a contract field the generated
 * input cannot carry, throw here.
 */
export function defineCommand<
  Contract extends CommandContract,
  Result,
  Target extends TargetRow | undefined = undefined,
>(
  contract: Contract,
  {
    returns,
    target,
    buildPayload,
    handle,
  }: CommandDefinition<ParsedInput<Contract>, Result, Target>,
): CommandProvider<ParsedInput<Contract>, Result, Target> {
  if (contract.target === 'existing' && !target) {
    throw new Error(
      `Command ${contract.name} changes an existing entity, so its definition needs target, which the command bus loads to check expectedVersion (ADR 0012)`,
    );
  }
  const command: Command<ParsedInput<Contract>, Result, Target> = {
    contract,
    target,
    buildPayload,
    handle,
  };
  return Object.assign(mutationResolver(command, returns), { command });
}
