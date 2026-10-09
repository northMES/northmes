// SPDX-License-Identifier: MIT
import { Inject, Injectable, type Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { OperationEntry, OperationsDeclaration } from '@northmes/contracts';
import type { z } from 'zod';

/** What a handler reaches besides its input: the module's providers, such as its service. */
export interface OperationContext {
  /** The provider of this class or token, such as the module's service. */
  get<Provider>(type: Type<Provider> | string | symbol): Provider;
}

/** The parsed input of an operation. */
type InputOf<Entry extends OperationEntry> = z.output<Entry['contract']['input']>;

/**
 * What a handler answers: the output schema's decoded side, such as a Date where JSON carries a
 * string, which the runner encodes with the schema.
 */
type AnswerOf<Entry> = Entry extends { readonly output: infer Output extends z.ZodType }
  ? z.output<Output>
  : unknown;

/**
 * One operation's handler: a call of one method of the module's service in core/, with no logic
 * of its own (ADR 0073). A read method queries through the ScopedDatabase, a write method sends
 * its command through the command bus.
 */
export type OperationHandler<Entry extends OperationEntry> = (
  input: InputOf<Entry>,
  context: OperationContext,
) => Promise<AnswerOf<Entry>>;

/** A handler for every operation of a declaration. */
export type OperationHandlers<Declaration extends OperationsDeclaration> = {
  readonly [Key in keyof Declaration['operations']]: OperationHandler<
    Declaration['operations'][Key] & OperationEntry
  >;
};

/** An instance of a bound declaration, which the host's operation runner calls. */
export interface BoundOperations {
  /** Runs the handler of operation `key` with an input its contract parsed. */
  handle(key: string, input: unknown): Promise<unknown>;
}

/** What bindOperations returns: a provider for the module's Nest module. */
export type BoundOperationsProvider<
  Declaration extends OperationsDeclaration = OperationsDeclaration,
> = Type<BoundOperations> & {
  readonly declaration: Declaration;
  readonly handlers: OperationHandlers<Declaration>;
};

/** Whether a provider class is one that bindOperations returned. */
export function isBoundOperationsProvider(value: unknown): value is BoundOperationsProvider {
  return (
    typeof value === 'function' &&
    'declaration' in value &&
    'handlers' in value &&
    typeof value.handlers === 'object'
  );
}

/** Upper camel case of a module or resource id, such as core or work-centers. */
function pascal(id: string): string {
  return id
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * Binds every operation of a declaration to its handler in the backend (ADR 0073). Listed in the
 * providers of the module's Nest module, it gives the host's operation runner the declaration and
 * the handlers, which reach the module's service through the context. A declaration operation
 * without a handler, or a handler of no operation, throws here.
 */
export function bindOperations<const Declaration extends OperationsDeclaration>(
  declaration: Declaration,
  handlers: OperationHandlers<Declaration>,
): BoundOperationsProvider<Declaration> {
  const { module, resource } = declaration;
  const keys = Object.keys(declaration.operations);
  const problems = [
    ...keys
      .filter((key) => !Object.hasOwn(handlers, key))
      .map((key) => `Operation ${module}.${resource}.${key} has no handler`),
    ...Object.keys(handlers)
      .filter((key) => !keys.includes(key))
      .map((key) => `Handler ${key} of ${module}.${resource} is not one of its operations`),
  ];
  if (problems.length > 0) throw new Error(problems.join('\n'));
  const table = handlers as unknown as Readonly<
    Record<string, (input: unknown, context: OperationContext) => Promise<unknown>>
  >;

  @Injectable()
  class Bound implements BoundOperations {
    readonly #context: OperationContext;

    constructor(@Inject(ModuleRef) moduleRef: ModuleRef) {
      this.#context = { get: (type) => moduleRef.get(type, { strict: false }) };
    }

    handle(key: string, input: unknown): Promise<unknown> {
      const handler = table[key];
      if (!handler) {
        return Promise.reject(new Error(`${module}.${resource} has no operation ${key}`));
      }
      return handler(input, this.#context);
    }
  }
  // Nest's messages name the class, so it carries the module and the resource.
  Object.defineProperty(Bound, 'name', { value: `${pascal(module)}${pascal(resource)}Operations` });
  return Object.assign(Bound, { declaration, handlers });
}
