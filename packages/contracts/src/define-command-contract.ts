// SPDX-License-Identifier: MIT
import { z } from 'zod';

/**
 * What a command acts on (ADR 0017). new: an entity it creates under the client-generated id in
 * its input, so a retry finds the first row (ADR 0012). existing: one entity, which the input names
 * by id. none: no one entity, so the input is the fields alone.
 */
export type CommandTarget = 'new' | 'existing' | 'none';

/** Any Zod object schema, whatever its unknown-key mode. */
type ObjectSchema = z.ZodObject<z.core.$ZodShape, z.core.$ZodObjectConfig>;

/**
 * Command validators of other modules and plugins may veto a validatable command. They get a
 * payload that the owner builds and parses with this schema, never the input (ADR 0037).
 */
type CommandValidation =
  | { readonly validatable: true; readonly payload: z.ZodType }
  | { readonly validatable?: false; readonly payload?: undefined };

export type CommandContractOptions = {
  /** `<module GraphQL name>.<command>`, such as planning.releaseProductionOrder. */
  readonly name: string;
  readonly target: CommandTarget;
  /** The fields a person edits, with their refinements. Forms validate these (ADR 0017). */
  readonly fields: ObjectSchema;
  /** Optional until the permission check of the pipeline arrives (E05-S01). */
  readonly permission?: string;
  /** Optional until the shared reason input arrives (E05-S01). */
  readonly reason?: 'optional' | 'required';
  /** Optional until the signature stage is declared (E05-S01). */
  readonly signature?: 'none';
} & CommandValidation;

/** Extends fields by the id that names the target entity. extend keeps the refinements. */
function withId<Shape extends z.core.$ZodShape, Config extends z.core.$ZodObjectConfig>(
  fields: z.ZodObject<Shape, Config>,
) {
  return fields.extend({ id: z.uuid() });
}

/** A command's input schema: the fields, plus the target's id when the target is an entity. */
type CommandInput<Options extends CommandContractOptions> = Options['target'] extends 'none'
  ? Options['fields']
  : ReturnType<typeof withId<Options['fields']['shape'], Options['fields']['_zod']['config']>>;

/**
 * A command's contract, plain data in the owning module's MIT contracts package, so manifests,
 * validators, plugins and web remotes read it without Nest or React (ADR 0012, ADR 0017).
 */
export type CommandContract<Options extends CommandContractOptions = CommandContractOptions> =
  Options & {
    /**
     * The schema the command pipeline parses every input with before anything else runs. It is
     * fields, extended by id unless the target is none, so it keeps the refinements of fields.
     */
    readonly input: CommandInput<Options>;
  };

/** Declares a command's contract and derives its input from its fields and target. */
export function defineCommandContract<const Options extends CommandContractOptions>(
  options: Options,
): CommandContract<Options> {
  // The types already refuse this; the check covers a contract built without them.
  const { name } = options;
  if (options.validatable && !options.payload) {
    throw new Error(
      `Command ${name} is validatable, so its contract needs a payload schema (ADR 0037)`,
    );
  }
  const input = options.target === 'none' ? options.fields : withId(options.fields);
  // TypeScript does not narrow a conditional type on a generic parameter, so the branch above
  // cannot check against CommandInput itself.
  return { ...options, input: input as CommandInput<Options> };
}
