// SPDX-License-Identifier: MIT
// Server-only: commands, whose mutation fields the SDK generates from their contracts (ADR 0012),
// and the command validators of other modules that may veto them (ADR 0037).
export {
  COMMAND_BUS,
  type Command,
  type CommandBus,
  type CommandTarget,
  type HandlerContext,
  type TargetRow,
} from './command-bus.ts';
export {
  type CommandDefinition,
  type CommandProvider,
  defineCommand,
  type RegisteredCommandDefinition,
  registerCommand,
} from './define-command.ts';
export { commandInput } from './mutation-field.ts';
export { parseCommandInput } from './parse-input.ts';
export {
  CommandValidator,
  type CommandValidatorProvider,
  type ValidatableContract,
  type Validator,
  type ValidatorVerdict,
} from './validator.ts';
