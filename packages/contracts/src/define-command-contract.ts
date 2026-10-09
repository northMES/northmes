// SPDX-License-Identifier: MIT
import { z } from 'zod';

/**
 * What a command acts on (ADR 0017). new: an entity it creates under the client-generated id in
 * its input, so a retry finds the first row (ADR 0012). existing: one entity, which the input names
 * by id with the version the change was made on. none: no one entity, so the input is the fields
 * alone.
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

/**
 * The version of an entity, which grows by one with every change to its row (ADR 0006). It is a
 * 32-bit integer from 1, so the generated mutation input carries it as Int (ADR 0017).
 */
export const version = z.int32().min(1);

/** Extends fields by the id that names the new entity. extend keeps the refinements. */
function withId<Shape extends z.core.$ZodShape, Config extends z.core.$ZodObjectConfig>(
  fields: z.ZodObject<Shape, Config>,
) {
  return fields.extend({ id: z.uuid() });
}

/**
 * Extends fields by the id that names an existing entity and the version the change was made on,
 * which the command pipeline compares with the entity's version (ADR 0012 step 5).
 */
function withIdAndVersion<Shape extends z.core.$ZodShape, Config extends z.core.$ZodObjectConfig>(
  fields: z.ZodObject<Shape, Config>,
) {
  return fields.extend({ id: z.uuid(), expectedVersion: version });
}

/**
 * The input schema for `Target`: the fields, plus the new entity's id for target new, or the
 * entity's id and expectedVersion for target existing (ADR 0017). It distributes over a union of
 * targets, so the input of a contract whose target is not known is any of the three.
 */
type InputFor<Target extends CommandTarget, Fields extends ObjectSchema> = Target extends 'none'
  ? Fields
  : Target extends 'new'
    ? ReturnType<typeof withId<Fields['shape'], Fields['_zod']['config']>>
    : ReturnType<typeof withIdAndVersion<Fields['shape'], Fields['_zod']['config']>>;

/** A command's input schema, from its target and its fields. */
type CommandInput<Options extends CommandContractOptions> = InputFor<
  Options['target'],
  Options['fields']
>;

/**
 * A command's contract, plain data in the owning module's MIT contracts package, so manifests,
 * validators, plugins and the web app read it without Nest or React (ADR 0012, ADR 0017).
 */
export type CommandContract<Options extends CommandContractOptions = CommandContractOptions> =
  Options & {
    /**
     * The schema the command pipeline parses every input with before anything else runs. It is
     * fields, extended by id for target new and by id and expectedVersion for target existing, so
     * it keeps the refinements of fields.
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
  const input =
    options.target === 'none'
      ? options.fields
      : options.target === 'new'
        ? withId(options.fields)
        : withIdAndVersion(options.fields);
  // TypeScript does not narrow a conditional type on a generic parameter, so the branch above
  // cannot check against CommandInput itself.
  return { ...options, input: input as CommandInput<Options> };
}
