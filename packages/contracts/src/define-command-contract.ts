// SPDX-License-Identifier: MIT
import { z } from 'zod';

/**
 * What a command acts on (ADR 0017). new: an entity it creates under the client-generated id in
 * its input, so a retry finds the first row (ADR 0012). existing: one entity, which the input names
 * by id. none: no one entity, so the input is the fields alone.
 */
export type CommandTarget = 'new' | 'existing' | 'none';

/** Extends fields by the id that names the target entity. extend keeps the refinements. */
function withId<Shape extends z.core.$ZodShape, Config extends z.core.$ZodObjectConfig>(
  fields: z.ZodObject<Shape, Config>,
) {
  return fields.extend({ id: z.uuid() });
}

/** A command's input schema: the fields, plus the target's id when the target is an entity. */
type CommandInput<
  Target extends CommandTarget,
  Shape extends z.core.$ZodShape,
  Config extends z.core.$ZodObjectConfig,
> = Target extends 'none' ? z.ZodObject<Shape, Config> : ReturnType<typeof withId<Shape, Config>>;

export interface CommandContractOptions<
  Name extends string,
  Target extends CommandTarget,
  Fields extends z.ZodObject,
> {
  /** `<module GraphQL name>.<command>`, such as planning.releaseProductionOrder. */
  readonly name: Name;
  readonly target: Target;
  /** The fields a person edits, with their refinements. Forms validate these (ADR 0017). */
  readonly fields: Fields;
}

/**
 * A command's contract, plain data in the owning module's MIT contracts package, so manifests,
 * validators, plugins and web remotes read it without Nest or React (ADR 0012, ADR 0017).
 */
export interface CommandContract<
  Name extends string = string,
  Target extends CommandTarget = CommandTarget,
  Fields extends z.ZodObject = z.ZodObject,
  Input extends z.ZodObject = z.ZodObject,
> extends CommandContractOptions<Name, Target, Fields> {
  /**
   * The schema the command pipeline parses every input with before anything else runs. It is
   * fields, extended by id unless the target is none, so it keeps the refinements of fields.
   */
  readonly input: Input;
}

/** Declares a command's contract and derives its input from its fields and target. */
export function defineCommandContract<
  const Name extends string,
  const Target extends CommandTarget,
  Shape extends z.core.$ZodShape,
  Config extends z.core.$ZodObjectConfig,
>(
  options: CommandContractOptions<Name, Target, z.ZodObject<Shape, Config>>,
): CommandContract<Name, Target, z.ZodObject<Shape, Config>, CommandInput<Target, Shape, Config>> {
  const input = options.target === 'none' ? options.fields : withId(options.fields);
  // TypeScript does not narrow a conditional type on a generic parameter, so the branch above
  // cannot check against CommandInput itself.
  return { ...options, input: input as CommandInput<Target, Shape, Config> };
}
