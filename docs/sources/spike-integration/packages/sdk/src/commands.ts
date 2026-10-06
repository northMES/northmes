import { SetMetadata } from "@nestjs/common";
import { GraphQLError } from "graphql";
import type { Principal } from "./context.js";

/**
 * Injection token and metadata key are plain strings on purpose: they still match if a
 * plugin ever carries its own copy of this package (a Symbol or a generated key would not).
 */
export const COMMAND_BUS = "northmes:command-bus";
export const COMMAND_VALIDATOR_KEY = "northmes:command-validator";

export interface CommandContext {
  readonly principal: Principal | null;
  readonly requestId: string;
}

export interface ValidatorVerdict {
  readonly reject?: string;
}

export interface CommandValidatorOptions {
  readonly command: string;
  /** Hard limit; a validator that runs longer rejects the command (fail closed). */
  readonly timeoutMs?: number;
}

/** Marks a provider method as a validator for a validatable command of another module. */
export const CommandValidator = (command: string, options: Omit<CommandValidatorOptions, "command"> = {}) =>
  SetMetadata(COMMAND_VALIDATOR_KEY, { command, ...options } satisfies CommandValidatorOptions);

export interface CommandBus {
  /** Runs validators of `command` in a fixed order, then the handler. */
  run<I, O>(command: string, input: I, ctx: CommandContext, handler: (input: I) => Promise<O>): Promise<O>;
}

export class CommandRejected extends GraphQLError {
  constructor(command: string, rejectedBy: string, reason: string) {
    super(reason, {
      extensions: { code: "PRECONDITION", errorCode: "core.command_rejected", details: { command, rejectedBy } },
    });
  }
}
