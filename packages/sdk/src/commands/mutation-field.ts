// SPDX-License-Identifier: MIT
import { Inject, type Type } from '@nestjs/common';
import {
  Args,
  Field,
  Float,
  ID,
  InputType,
  Int,
  Mutation,
  Resolver,
  type ReturnTypeFunc,
} from '@nestjs/graphql';
import type { CommandContract } from '@northmes/contracts';
import { GraphQLError } from 'graphql';
import { z } from 'zod';
import type { FieldError } from '../errors/domain-error.ts';
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

/** The bounds of GraphQL's Int, a signed 32-bit integer. */
const INT_MIN = -(2 ** 31);
const INT_MAX = 2 ** 31 - 1;

/**
 * The GraphQL scalar of a required input field, from its JSON Schema, or undefined. An integer is
 * an Int only when its schema bounds it to 32 bits, as z.int32() does (ADR 0017).
 */
function scalarOf(property: z.core.JSONSchema._JSONSchema): ReturnTypeFunc | undefined {
  if (typeof property !== 'object') return undefined;
  if (property.type === 'string' && property.format === 'uuid') return () => ID;
  if (property.type === 'string') return () => String;
  if (property.type === 'number') return () => Float;
  if (
    property.type === 'integer' &&
    property.minimum !== undefined &&
    property.minimum >= INT_MIN &&
    property.maximum !== undefined &&
    property.maximum <= INT_MAX
  ) {
    return () => Int;
  }
  return undefined;
}

/**
 * The input type of a command's mutation, built from contract.input. It covers the field kinds the
 * skeleton uses: required ID, string, number and 32-bit integer fields. Any other field throws,
 * naming it, before a type is registered; the full converter is inputFromZod (ADR 0017, E05-S01).
 */
function inputType(contract: CommandContract, typeName: string): Type {
  const schema = z.toJSONSchema(contract.input, { io: 'input' });
  const required = new Set(schema.required);
  const fields = Object.entries(schema.properties ?? {}).map(([field, property]) => {
    const scalar = required.has(field) ? scalarOf(property) : undefined;
    if (!scalar) {
      throw new Error(
        `Command ${contract.name}: input field ${field} is not a required ID, string, number or 32-bit integer, the kinds a generated mutation input supports so far`,
      );
    }
    return { field, scalar };
  });
  const Input = { [typeName]: class {} }[typeName] as Type;
  for (const { field, scalar } of fields) Field(scalar)(Input.prototype, field);
  InputType(typeName)(Input);
  return Input;
}

/**
 * Parses a command's input with its contract. A failure is BAD_USER_INPUT with one fieldErrors
 * entry per Zod issue, whose path is relative to the input (ADR 0012, ADR 0017).
 */
function parseInput(contract: CommandContract, input: unknown): unknown {
  const parsed = contract.input.safeParse(input);
  if (parsed.success) return parsed.data;
  const { issues } = parsed.error;
  const problems = issues.map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`);
  const fieldErrors: FieldError[] = issues.map(({ path, message, code }) => ({
    path: path.map((segment) => (typeof segment === 'symbol' ? String(segment) : segment)),
    message,
    code,
  }));
  throw new GraphQLError(`Invalid input for ${contract.name}: ${problems.join('; ')}`, {
    extensions: { code: 'BAD_USER_INPUT', fieldErrors },
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
