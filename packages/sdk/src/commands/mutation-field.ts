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
import { z } from 'zod';
import { PLANT_FREE } from '../graphql/plant-free.ts';
import { COMMAND_BUS, type Command, type CommandBus } from './command-bus.ts';
import { parseCommandInput } from './parse-input.ts';

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

/** True for the JSON Schema of a list of plain strings. */
function isStringList(property: z.core.JSONSchema.JSONSchema): boolean {
  const { items } = property;
  return (
    property.type === 'array' &&
    typeof items === 'object' &&
    !Array.isArray(items) &&
    items.type === 'string' &&
    items.format === undefined
  );
}

/**
 * The GraphQL type of an input field, from its JSON Schema, or undefined for a kind the generated
 * input cannot carry: a required scalar, boolean or list of strings, or an optional string,
 * boolean, 32-bit integer or list of strings, which is nullable.
 */
function inputFieldType(
  property: z.core.JSONSchema._JSONSchema,
  required: boolean,
): ReturnTypeFunc | undefined {
  if (typeof property !== 'object') return undefined;
  if (property.type === 'boolean') return () => Boolean;
  if (isStringList(property)) return () => [String];
  if (!required) {
    if (property.type === 'string') return () => String;
    return property.type === 'integer' ? scalarOf(property) : undefined;
  }
  return scalarOf(property);
}

/**
 * The fields of a command's input type, built from contract.input. It covers the field kinds the
 * commands use so far: required ID, string, number, boolean, 32-bit integer and list of strings
 * fields, and optional strings, booleans, 32-bit integers and lists of strings. Any other field throws, naming it,
 * before a type is registered; the full converter is inputFromZod (ADR 0017, E05-S01).
 */
function inputFields(contract: CommandContract): InputField[] {
  const schema = z.toJSONSchema(contract.input, { io: 'input' });
  const required = new Set(schema.required);
  return Object.entries(schema.properties ?? {}).map(([field, property]) => {
    const type = inputFieldType(property, required.has(field));
    if (!type) {
      throw new Error(
        `Command ${contract.name}: input field ${field} is not a required ID, string, number, boolean, 32-bit integer or list of strings, or an optional string, boolean, 32-bit integer or list of strings, the kinds a generated mutation input supports so far`,
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

/** The input type of each contract, so a command's type is registered once. */
const inputTypes = new WeakMap<CommandContract, Type>();

/**
 * The GraphQL input type of a command, built from its contract and named after its Mutation
 * field, such as CoreCreateArticleInput for core.createArticle. A module's own mutation resolver
 * takes it as the type of its input argument, and hands the input to the module's service, which
 * parses it with parseCommandInput and sends it to the command bus (ADR 0073).
 */
export function commandInput(contract: CommandContract): Type {
  const known = inputTypes.get(contract);
  if (known) return known;
  const Input = inputType(
    inputFields(contract),
    `${capitalize(mutationFieldName(contract.name))}Input`,
  );
  inputTypes.set(contract, Input);
  return Input;
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
  const Input = commandInput(command.contract);

  @Resolver()
  class CommandResolver {
    constructor(@Inject(COMMAND_BUS) private readonly bus: CommandBus) {}

    @Mutation(returns, { name: fieldName })
    @Extensions({ [PLANT_FREE]: plantFree === true })
    run(@Args('input', { type: () => Input }) input: unknown): Promise<unknown> {
      return this.bus.run(command, parseCommandInput(command.contract, input));
    }
  }
  // Nest's messages name the class, so it carries the field's name.
  Object.defineProperty(CommandResolver, 'name', { value: `${capitalize(fieldName)}Mutation` });
  return CommandResolver;
}
