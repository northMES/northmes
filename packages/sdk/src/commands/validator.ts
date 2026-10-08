// SPDX-License-Identifier: MIT
import type { Type } from '@nestjs/common';
import type { CommandContract } from '@northmes/contracts';
import type { z } from 'zod';

/** The contract of a command that command validators of other modules may veto (ADR 0037). */
export type ValidatableContract = CommandContract & {
  readonly validatable: true;
  readonly payload: z.ZodType;
};

/**
 * What a command validator returns: pass lets the command go on, and a veto rejects it with a
 * message for the person who ran it.
 */
export type ValidatorVerdict =
  | { readonly verdict: 'pass' }
  | { readonly verdict: 'veto'; readonly message: string };

/** A command validator of one validatable command. */
export interface Validator<Contract extends ValidatableContract = ValidatableContract> {
  /**
   * The validating module's own copy of the owner's contract, from the contracts package it
   * bundled. The bus parses the owner's payload with this copy's schema before check runs.
   */
  readonly contract: Contract;
  /** Orders the validators of one module, after the catalog order of the modules (ADR 0012). */
  readonly name: string;
  /**
   * How long check may take, in milliseconds. A check that has not answered by then rejects the
   * command (ADR 0037). Without it, the host's default limit applies. It is above 0 and no longer
   * than the command's limit, which is the host's default until owners declare one (ADR 0012), and
   * boot refuses a validator that sets any other value.
   */
  readonly timeoutMs?: number;
  /**
   * Answers for the payload the owner built for this run of the command. The payload is frozen, so
   * an assignment to it throws. A throw rejects the command, and the client reads "Unexpected
   * error." (ADR 0037).
   */
  check(payload: z.output<Contract['payload']>): Promise<ValidatorVerdict>;
}

/** What CommandValidator returns: a provider for the validating module's Nest module. */
export type CommandValidatorProvider<Contract extends ValidatableContract = ValidatableContract> =
  Type & {
    /** The validator the host finds among the module's providers. */
    readonly validator: Validator<Contract>;
  };

/**
 * Registers a command validator. Listed in the providers of the Nest module that the validating
 * module's server entry exports, it lets the module veto `contract`'s command, which another
 * module owns (ADR 0037).
 */
export function CommandValidator<Contract extends ValidatableContract>(
  contract: Contract,
  options: Omit<Validator<Contract>, 'contract'>,
): CommandValidatorProvider<Contract> {
  const validator: Validator<Contract> = { contract, ...options };
  return Object.assign(class {}, { validator });
}
