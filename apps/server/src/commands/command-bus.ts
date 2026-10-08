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
 * A validator's veto (ADR 0012): core.command_rejected, whose details name the module that vetoed
 * in rejectedBy, with the message the validator gave.
 */
export class CommandRejected extends DomainError {
  constructor(rejectedBy: string, message: string) {
    super({
      code: 'core.command_rejected',
      kind: 'precondition',
      message,
      details: { rejectedBy },
    });
  }
}

/**
 * Compares validator names by character code. localeCompare would follow the machine's locale, and
 * the order of validators must be the same on every machine.
 */
function compareNames(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/**
 * The validators of each command by command name, in catalog order of their modules and then by
 * name (ADR 0012).
 */
function validatorsByCommand({
  modules,
  validators,
}: CommandBusOptions): Map<string, RegisteredValidator[]> {
  const position = (module: string) => modules.indexOf(module);
  const ordered = [...validators].sort(
    (a, b) =>
      position(a.module) - position(b.module) || compareNames(a.validator.name, b.validator.name),
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
 * owner's contract and runs the validators, then it runs the handler (ADR 0012, ADR 0037). The
 * first veto rejects the command, and the transaction rolls back.
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
          const verdict = await validator.check(parsed.data);
          if (verdict.verdict === 'veto') throw new CommandRejected(module, verdict.message);
        }
      }
      return command.handle(input, context);
    });
  }
}
