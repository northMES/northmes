// SPDX-License-Identifier: MIT
import type { CommandContract } from '@northmes/contracts';
import { GraphQLError } from 'graphql';
import { z } from 'zod';
import type { FieldError } from '../errors/domain-error.ts';

/** The optional fields of each contract's input, by contract. */
const optionalFieldsOf = new WeakMap<CommandContract, ReadonlySet<string>>();

/** The fields of a contract's input that the client may leave out. */
function optionalFields(contract: CommandContract): ReadonlySet<string> {
  const known = optionalFieldsOf.get(contract);
  if (known) return known;
  const schema = z.toJSONSchema(contract.input, { io: 'input' });
  const required = new Set(schema.required);
  const optional = new Set(
    Object.keys(schema.properties ?? {}).filter((key) => !required.has(key)),
  );
  optionalFieldsOf.set(contract, optional);
  return optional;
}

/**
 * The input as the contract reads it: an optional field the client sent as null is left out, since
 * GraphQL has null where the contract has an absent field.
 */
function withoutNulls(contract: CommandContract, input: unknown): unknown {
  if (typeof input !== 'object' || input === null) return input;
  const optional = optionalFields(contract);
  return Object.fromEntries(
    Object.entries(input).filter(([field, value]) => !(optional.has(field) && value === null)),
  );
}

/**
 * Parses a command's input with its contract, after it leaves out the optional fields that are
 * null. A failure is BAD_USER_INPUT with one fieldErrors entry per Zod issue, whose path is
 * relative to the input (ADR 0012, ADR 0017). A module's service calls it before it sends the
 * command to the bus, so every surface parses the same way (ADR 0073).
 */
export function parseCommandInput<Contract extends CommandContract>(
  contract: Contract,
  input: unknown,
): z.output<Contract['input']> {
  const parsed = contract.input.safeParse(withoutNulls(contract, input));
  if (parsed.success) return parsed.data as z.output<Contract['input']>;
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
