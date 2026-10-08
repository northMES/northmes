// SPDX-License-Identifier: MIT
import type { Type } from '@nestjs/common';
import type { ReturnTypeFunc } from '@nestjs/graphql';
import type { CommandContract } from '@northmes/contracts';
import type { z } from 'zod';
import type { Command } from './command-bus.ts';
import { mutationResolver } from './mutation-field.ts';

/** The server code of a command, in the owning module's AGPL server code. */
export interface CommandDefinition<Input, Result>
  extends Pick<Command<Input, Result>, 'buildPayload' | 'handle'> {
  /** The GraphQL type of the handler's result, which the mutation returns. */
  readonly returns: ReturnTypeFunc;
}

/** What defineCommand returns: a provider for the module's Nest module. */
export type CommandProvider<Input, Result> = Type & {
  /** The command the generated mutation field sends to the bus. */
  readonly command: Command<Input, Result>;
};

/** The input of a command once its contract parsed it. */
type ParsedInput<Contract extends CommandContract> = z.output<Contract['input']>;

/**
 * Registers a command's server code. Listed in the providers of the module's Nest module, it adds
 * the command's prefixed Mutation field to the schema, so the module writes no resolver for it
 * (ADR 0012). A contract field the generated input cannot carry throws here.
 */
export function defineCommand<Contract extends CommandContract, Result>(
  contract: Contract,
  { returns, buildPayload, handle }: CommandDefinition<ParsedInput<Contract>, Result>,
): CommandProvider<ParsedInput<Contract>, Result> {
  const command: Command<ParsedInput<Contract>, Result> = { contract, buildPayload, handle };
  return Object.assign(mutationResolver(command, returns), { command });
}
