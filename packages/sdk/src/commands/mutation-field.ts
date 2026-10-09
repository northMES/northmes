// SPDX-License-Identifier: MIT
import { Inject, type Type } from '@nestjs/common';
import {
  Args,
  Extensions,
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
import { PLANT_FREE } from '../graphql/plant-free.ts';
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

/** A field of a generated input type: its GraphQL type and whether it may be left out. */
interface InputField {
  readonly field: string;
  readonly type: ReturnTypeFunc;
  readonly optional: boolean;
}

/**
 * The GraphQL type of an input field, from its JSON Schema, or undefined for a kind the generated
 * input cannot carry: a required scalar, a required list of strings, or an optional string, which
 * is a nullable String.
 */
function inputFieldType(
  property: z.core.JSONSchema._JSONSchema,
  required: boolean,
): ReturnTypeFunc | undefined {
  if (typeof property !== 'object') return undefined;
  if (!required) return property.type === 'string' ? () => String : undefined;
  const { items } = property;
  if (property.type === 'array' && typeof items === 'object' && !Array.isArray(items)) {
    return items.type === 'string' && items.format === undefined ? () => [String] : undefined;
  }
  return scalarOf(property);
}

/**
 * The fields of a command's input type, built from contract.input. It covers the field kinds the
 * commands use so far: required ID, string, number, 32-bit integer and list of strings fields, and
 * optional strings. Any other field throws, naming it, before a type is registered; the full
 * converter is inputFromZod (ADR 0017, E05-S01).
 */
function inputFields(contract: CommandContract): InputField[] {
  const schema = z.toJSONSchema(contract.input, { io: 'input' });
  const required = new Set(schema.required);
  return Object.entries(schema.properties ?? {}).map(([field, property]) => {
    const type = inputFieldType(property, required.has(field));
    if (!type) {
      throw new Error(
        `Command ${contract.name}: input field ${field} is not a required ID, string, number, 32-bit integer or list of strings, or an optional string, the kinds a generated mutation input supports so far`,
      );
    }
    return { field, type, optional: !required.has(field) };
  });
}

/** The input type of a command's mutation, with these fields. */
function inputType(fields: readonly InputField[], typeName: string): Type {
  const Input = { [typeName]: class {} }[typeName] as Type;
  for (const { field, type, optional } of fields) {
    Field(type, { nullable: optional })(Input.prototype, field);
  }
  InputType(typeName)(Input);
  return Input;
}

/**
 * The input as the contract reads it: an optional field the client sent as null is left out, since
 * GraphQL has null where the contract has an absent field.
 */
function withoutNulls(fields: readonly InputField[], input: unknown): unknown {
  if (typeof input !== 'object' || input === null) return input;
  const optional = new Set(fields.filter((field) => field.optional).map(({ field }) => field));
  return Object.fromEntries(
    Object.entries(input).filter(([field, value]) => !(optional.has(field) && value === null)),
  );
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
 * to the command bus. A plant-free command's field carries the plant-free mark (ADR 0066).
 */
export function mutationResolver(
  command: Command,
  returns: ReturnTypeFunc,
  { plantFree }: { readonly plantFree?: true } = {},
): Type {
  const fieldName = mutationFieldName(command.contract.name);
  const fields = inputFields(command.contract);
  const Input = inputType(fields, `${capitalize(fieldName)}Input`);

  @Resolver()
  class CommandResolver {
    constructor(@Inject(COMMAND_BUS) private readonly bus: CommandBus) {}

    @Mutation(returns, { name: fieldName })
    @Extensions({ [PLANT_FREE]: plantFree === true })
    run(@Args('input', { type: () => Input }) input: unknown): Promise<unknown> {
      return this.bus.run(command, parseInput(command.contract, withoutNulls(fields, input)));
    }
  }
  // Nest's messages name the class, so it carries the field's name.
  Object.defineProperty(CommandResolver, 'name', { value: `${capitalize(fieldName)}Mutation` });
  return CommandResolver;
}
