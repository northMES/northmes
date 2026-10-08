// SPDX-License-Identifier: MIT
import { Inject, type Type } from '@nestjs/common';
import {
  Args,
  Field,
  Float,
  ID,
  InputType,
  Mutation,
  Resolver,
  type ReturnTypeFunc,
} from '@nestjs/graphql';
import type { CommandContract } from '@northmes/contracts';
import { GraphQLError } from 'graphql';
import { z } from 'zod';
import { COMMAND_BUS, type Command, type CommandBus } from './command-bus.ts';

function capitalize(name: string): string {
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

/**
 * The Mutation field of a command: its module prefix, then its name, so
 * planning.releaseProductionOrder gives planningReleaseProductionOrder.
 */
function mutationFieldName(commandName: string): string {
  const [prefix = '', name = ''] = commandName.split('.');
  return `${prefix}${capitalize(name)}`;
}

/** The GraphQL scalar of one input field, from its JSON Schema. */
function scalarOf(property: z.core.JSONSchema._JSONSchema): ReturnTypeFunc {
  if (typeof property === 'object') {
    if (property.type === 'string' && property.format === 'uuid') return () => ID;
    if (property.type === 'string') return () => String;
    if (property.type === 'number') return () => Float;
  }
  throw new Error('Unsupported input field');
}

/**
 * The input type of a command's mutation, built from contract.input. It covers the field kinds the
 * skeleton uses: ID, string and number.
 */
function inputType(contract: CommandContract, typeName: string): Type {
  const Input = { [typeName]: class {} }[typeName] as Type;
  const schema = z.toJSONSchema(contract.input, { io: 'input' });
  for (const [field, property] of Object.entries(schema.properties ?? {})) {
    Field(scalarOf(property))(Input.prototype, field);
  }
  InputType(typeName)(Input);
  return Input;
}

/**
 * Parses a command's input with its contract. A failure is BAD_USER_INPUT (ADR 0012); the
 * fieldErrors extension arrives with the error model (E05-S01).
 */
function parseInput(contract: CommandContract, input: unknown): unknown {
  const parsed = contract.input.safeParse(input);
  if (parsed.success) return parsed.data;
  const problems = parsed.error.issues.map(
    (issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`,
  );
  throw new GraphQLError(`Invalid input for ${contract.name}: ${problems.join('; ')}`, {
    extensions: { code: 'BAD_USER_INPUT' },
  });
}

/**
 * A resolver class with the command's Mutation field. Its one argument, input, has the input type
 * built from the contract, and the field parses the input with the contract and sends the result
 * to the command bus.
 */
export function mutationResolver(command: Command, returns: ReturnTypeFunc): Type {
  const fieldName = mutationFieldName(command.contract.name);
  const Input = inputType(command.contract, `${capitalize(fieldName)}Input`);

  @Resolver()
  class CommandResolver {
    constructor(@Inject(COMMAND_BUS) private readonly bus: CommandBus) {}

    @Mutation(returns, { name: fieldName })
    run(@Args('input', { type: () => Input }) input: unknown): Promise<unknown> {
      return this.bus.run(command, parseInput(command.contract, input));
    }
  }
  // Nest's messages name the class, so it carries the field's name.
  Object.defineProperty(CommandResolver, 'name', { value: `${capitalize(fieldName)}Mutation` });
  return CommandResolver;
}
