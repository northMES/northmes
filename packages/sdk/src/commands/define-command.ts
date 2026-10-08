// SPDX-License-Identifier: MIT
import type { Type } from '@nestjs/common';
import type { ReturnTypeFunc } from '@nestjs/graphql';
import type { CommandContract } from '@northmes/contracts';
import type { z } from 'zod';
import type { Command } from './command-bus.ts';
import { mutationResolver } from './mutation-field.ts';

/** The server code of a command, in the owning module's AGPL server code. */
export interface CommandDefinition<Input, Result> {
  /** The GraphQL type of the handler's result, which the mutation returns. */
  readonly returns: ReturnTypeFunc;
  /**
   * Builds the payload that the command validators get. A validatable contract needs it
   * (ADR 0037).
   */
  buildPayload?(input: Input): Promise<unknown>;
  /** Makes the change with an input the contract parsed, and returns the mutation's result. */
  handle(input: Input): Promise<Result>;
}

/** What defineCommand returns: a provider for the module's Nest module. */
export type CommandProvider<Input, Result> = Type & {
  /** The command the generated mutation field sends to the bus. */
  readonly command: Command<Input, Result>;
};

/**
 * Registers a command's server code. Listed in the providers of the module's Nest module, it adds
 * the command's prefixed Mutation field to the module's subgraph, so the module writes no
 * resolver for it (ADR 0012).
 */
export function defineCommand<Contract extends CommandContract, Result>(
  contract: Contract,
  { returns, buildPayload, handle }: CommandDefinition<z.output<Contract['input']>, Result>,
): CommandProvider<z.output<Contract['input']>, Result> {
  const command: Command<z.output<Contract['input']>, Result> = { contract, buildPayload, handle };
  return Object.assign(mutationResolver(command, returns), { command });
}
