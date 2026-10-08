// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Command, CommandBus, Validator } from '@northmes/sdk/commands';
import type { ScopedDatabase } from '@northmes/sdk/data';
import { DomainError } from '@northmes/sdk/errors';

/** A command validator, with the id of the module whose server code registered it. */
export interface RegisteredValidator {
  readonly module: string;
  readonly validator: Validator;
}

export interface CommandBusOptions {
  /** The ids of the catalog's modules in boot order. */
  readonly modules: readonly string[];
  /** Every validator of the catalog's modules, in any order. */
  readonly validators: readonly RegisteredValidator[];
}

/**
 * The validators of each command by command name, in catalog order of their modules and then by
 * name (ADR 0012). Names compare by code point, so the order is the same on every machine.
 */
function validatorsByCommand({
  modules,
  validators,
}: CommandBusOptions): Map<string, RegisteredValidator[]> {
  const position = (module: string) => modules.indexOf(module);
  const ordered = [...validators].sort(
    (a, b) =>
      position(a.module) - position(b.module) ||
      (a.validator.name < b.validator.name ? -1 : a.validator.name > b.validator.name ? 1 : 0),
  );
  const byCommand = new Map<string, RegisteredValidator[]>();
  for (const registered of ordered) {
    const { name } = registered.validator.contract;
    byCommand.set(name, [...(byCommand.get(name) ?? []), registered]);
  }
  return byCommand;
}

/**
 * The command bus of the host. It runs each command in one ScopedDatabase transaction: for a
 * command with validators it builds the payload, parses it with each validator's copy of the
 * owner's contract and runs the validators, then it runs the handler (ADR 0012, ADR 0037).
 */
export class CommandBusImpl implements CommandBus {
  readonly #database: ScopedDatabase<unknown>;
  readonly #validators: Map<string, RegisteredValidator[]>;

  constructor(database: ScopedDatabase<unknown>, options: CommandBusOptions) {
    this.#database = database;
    this.#validators = validatorsByCommand(options);
  }

  run<Input, Result>(command: Command<Input, Result>, input: Input): Promise<Result> {
    const { name } = command.contract;
    const validators = this.#validators.get(name) ?? [];
    return this.#database.transaction(async (tx) => {
      const context = { tx };
      if (validators.length > 0) {
        const payload = await command.buildPayload?.(input, context);
        for (const { module, validator } of validators) {
          const parsed = validator.contract.payload.safeParse(payload);
          if (!parsed.success) {
            throw new DomainError({
              code: 'core.validator_contract_mismatch',
              kind: 'precondition',
              message: `The payload of ${name} does not match the contract that validator ${validator.name} of module ${module} was built with`,
            });
          }
          await validator.check(parsed.data);
        }
      }
      return command.handle(input, context);
    });
  }
}
