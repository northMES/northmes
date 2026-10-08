// SPDX-License-Identifier: MIT
import { z } from 'zod';

/** Extends fields by the id that names the target entity. extend keeps the refinements. */
function withId<Shape extends z.core.$ZodShape, Config extends z.core.$ZodObjectConfig>(
  fields: z.ZodObject<Shape, Config>,
) {
  return fields.extend({ id: z.uuid() });
}

/** A command's input schema: the fields plus the target's id. */
type CommandInput<
  Shape extends z.core.$ZodShape,
  Config extends z.core.$ZodObjectConfig,
> = ReturnType<typeof withId<Shape, Config>>;

export interface CommandContractOptions<Name extends string, Fields extends z.ZodObject> {
  /** `<module GraphQL name>.<command>`, such as planning.releaseProductionOrder. */
  readonly name: Name;
  /** existing: the command changes one entity, which the input names by id. */
  readonly target: 'existing';
  /** The fields a person edits, with their refinements. Forms validate these (ADR 0017). */
  readonly fields: Fields;
}

/**
 * A command's contract, plain data in the owning module's MIT contracts package, so manifests,
 * validators, plugins and web remotes read it without Nest or React (ADR 0012, ADR 0017).
 */
export interface CommandContract<
  Name extends string = string,
  Fields extends z.ZodObject = z.ZodObject,
  Input extends z.ZodObject = z.ZodObject,
> extends CommandContractOptions<Name, Fields> {
  /**
   * The schema the command pipeline parses every input with before anything else runs. It is
   * fields extended by id, so it keeps the refinements of fields.
   */
  readonly input: Input;
}

/** Declares a command's contract and derives its input from its fields and target. */
export function defineCommandContract<
  const Name extends string,
  Shape extends z.core.$ZodShape,
  Config extends z.core.$ZodObjectConfig,
>(
  options: CommandContractOptions<Name, z.ZodObject<Shape, Config>>,
): CommandContract<Name, z.ZodObject<Shape, Config>, CommandInput<Shape, Config>> {
  return { ...options, input: withId(options.fields) };
}
