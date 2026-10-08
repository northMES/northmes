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
  /** Every validator of the catalog's modules. */
  readonly validators: readonly RegisteredValidator[];
}

/** The command bus of the host: runs each command in the order of ADR 0012. */
export class CommandBusImpl implements CommandBus {
  readonly #database: ScopedDatabase<unknown>;
  readonly #validators: readonly RegisteredValidator[];

  constructor(database: ScopedDatabase<unknown>, { validators }: CommandBusOptions) {
    this.#database = database;
    this.#validators = validators;
  }

  run<Input, Result>(command: Command<Input, Result>, input: Input): Promise<Result> {
    const { name } = command.contract;
    return this.#database.transaction(async () => {
      const validators = this.#validators.filter(
        ({ validator }) => validator.contract.name === name,
      );
      if (validators.length > 0) {
        const payload = await command.buildPayload?.(input);
        for (const { module, validator } of validators) {
          if (!validator.contract.payload.safeParse(payload).success) {
            throw new DomainError({
              code: 'core.validator_contract_mismatch',
              kind: 'precondition',
              message: `The payload of ${name} does not match the contract that validator ${validator.name} of module ${module} was built with`,
            });
          }
        }
      }
      return command.handle(input);
    });
  }
}
