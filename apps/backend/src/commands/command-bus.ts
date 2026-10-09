// SPDX-License-Identifier: AGPL-3.0-or-later
import { HttpStatus } from '@nestjs/common';
import type {
  Command,
  CommandBus,
  Validator,
  ValidatorVerdict,
  Versioned,
} from '@northmes/sdk/commands';
import type { ScopedDatabase } from '@northmes/sdk/data';
import { DomainError, toDomainError } from '@northmes/sdk/errors';
import type { Transaction } from 'kysely';
import { currentPrincipal } from '../principal.ts';

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
      status: HttpStatus.PRECONDITION_FAILED,
      message,
      details: { rejectedBy },
    });
  }
}

/**
 * The time limit of a validator that declares none, in milliseconds. Until owners declare a limit
 * per command, it is also the longest limit a validator may declare: discoverValidators refuses a
 * longer one at boot (ADR 0012 step 6).
 */
export const DEFAULT_VALIDATOR_TIMEOUT_MS = 2_000;

/**
 * A validator that threw or did not answer within its time limit (ADR 0037). The command fails
 * closed, and the client reads only "Unexpected error.". The cause is what the validator threw, or
 * an error that names the validator and the limit it missed, for the server's log.
 */
export class ValidatorFailed extends Error {
  constructor(cause: unknown) {
    super('Unexpected error.', { cause });
    this.name = 'ValidatorFailed';
  }
}

/**
 * Freezes a value and every object and array in it, so a validator that assigns to its payload
 * throws instead of changing it (ADR 0037).
 */
function deepFreeze<Value>(value: Value): Value {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const property of Object.values(value)) deepFreeze(property);
  }
  return value;
}

/**
 * Runs a validator's check within its time limit. A check that throws or has not answered by then
 * throws ValidatorFailed.
 */
async function checkWithinLimit(
  { module, validator }: RegisteredValidator,
  payload: unknown,
): Promise<ValidatorVerdict> {
  const limit = validator.timeoutMs ?? DEFAULT_VALIDATOR_TIMEOUT_MS;
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new Error(
            `Validator ${validator.name} of module ${module} did not answer within ${limit} ms`,
          ),
        ),
      limit,
    );
  });
  try {
    return await Promise.race([validator.check(payload), timeout]);
  } catch (error) {
    throw new ValidatorFailed(error);
  } finally {
    clearTimeout(timer);
  }
}

/** What the bus reads of the input of a command on an existing entity (ADR 0017). */
interface ExistingInput {
  readonly id: string;
  readonly expectedVersion: number;
}

/**
 * Loads the target of a command on an existing entity and checks its version (ADR 0012 steps 3 and
 * 5): core.not_found when no row with the input's id is at the principal's scopes, and
 * core.version_conflict when the row's version is not the input's expectedVersion. A command
 * without a target gets undefined.
 */
async function loadTarget<Input, Result, Target extends Versioned | undefined>(
  command: Command<Input, Result, Target>,
  input: Input,
  context: { readonly tx: Transaction<unknown>; readonly plantId: string | undefined },
): Promise<Target | undefined> {
  if (!command.target) return undefined;
  const { entity, load } = command.target;
  const { id, expectedVersion } = input as ExistingInput;
  const row = await load(id, context);
  if (!row) {
    throw new DomainError({
      code: 'core.not_found',
      status: HttpStatus.NOT_FOUND,
      message: `${entity} ${id} was not found`,
    });
  }
  if (row.version !== expectedVersion) {
    throw new DomainError({
      code: 'core.version_conflict',
      status: HttpStatus.CONFLICT,
      message: `${entity} ${id} is at version ${row.version}, and the change was made on version ${expectedVersion}`,
    });
  }
  return row;
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
 * command on an existing entity it loads the target and checks its version, for a command with
 * validators it builds the payload, parses it with each validator's copy of the owner's contract
 * and runs the validators, each on its own frozen copy and within its time limit, then it runs the
 * handler (ADR 0012, ADR 0037). The first refusal, veto, throw or missed limit rejects the command,
 * and the transaction rolls back.
 */
export class CommandBusImpl implements CommandBus {
  readonly #database: ScopedDatabase<unknown>;
  readonly #validators: Map<string, RegisteredValidator[]>;

  constructor(database: ScopedDatabase<unknown>, options: CommandBusOptions) {
    this.#database = database;
    this.#validators = validatorsByCommand(options);
  }

  run<Input, Result, Target extends Versioned | undefined>(
    command: Command<Input, Result, Target>,
    input: Input,
  ): Promise<Result> {
    const { name } = command.contract;
    const validators = this.#validators.get(name) ?? [];
    return this.#transaction(async (tx) => {
      const plantId = currentPrincipal()?.plantId;
      // A command without a target gets undefined, which its Target type then is.
      const target = (await loadTarget(command, input, { tx, plantId })) as Target;
      const context = { tx, plantId, target };
      if (validators.length > 0) {
        const payload = await command.buildPayload?.(input, context);
        for (const registered of validators) {
          const { module, validator } = registered;
          const parsed = validator.contract.payload.safeParse(payload);
          if (!parsed.success) {
            throw new DomainError({
              code: 'core.validator_contract_mismatch',
              status: HttpStatus.PRECONDITION_FAILED,
              message: `The payload of ${name} does not match the contract that validator ${validator.name} of module ${module} was built with`,
            });
          }
          const verdict = await checkWithinLimit(registered, deepFreeze(parsed.data));
          if (verdict.verdict === 'veto') throw new CommandRejected(module, verdict.message);
        }
      }
      return command.handle(input, context);
    });
  }

  /**
   * Runs fn in one ScopedDatabase transaction. A database error, also one from the commit, reaches
   * the caller as the DomainError toDomainError maps it to (ADR 0012).
   */
  async #transaction<Result>(fn: (tx: Transaction<unknown>) => Promise<Result>): Promise<Result> {
    try {
      return await this.#database.transaction(fn);
    } catch (error) {
      throw toDomainError(error);
    }
  }
}
