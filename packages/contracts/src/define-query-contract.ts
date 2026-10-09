// SPDX-License-Identifier: MIT
import { z } from 'zod';

/** Any Zod object schema, whatever its unknown-key mode. */
type ObjectSchema = z.ZodObject<z.core.$ZodShape, z.core.$ZodObjectConfig>;

export interface QueryContractOptions {
  /** `<module>.<query>`, such as core.getArticle. */
  readonly name: string;
  /** What a caller sends. */
  readonly input: ObjectSchema;
  /**
   * What the query answers. The operation runner validates every answer with it and drops any key
   * outside it, so it is the published shape on every surface (ADR 0017, ADR 0073).
   */
  readonly output: z.ZodType;
  /**
   * The permission, `<module>.<entity>:<action>`, that the principal must hold at the request's
   * plant, or at the company for a request without one (ADR 0073).
   */
  readonly permission: string;
}

/**
 * A read's contract, plain data in the owning module's MIT contracts package, which the backend
 * binds to a service method and the surfaces publish (ADR 0073). A query never writes.
 */
export type QueryContract<Options extends QueryContractOptions = QueryContractOptions> = Options & {
  readonly kind: 'query';
};

/** A module-prefixed operation name, such as core.getArticle. */
const operationName = /^[a-z][a-zA-Z0-9]*\.[a-z][a-zA-Z0-9]*$/;

/** Throws unless `name` is `<module>.<operation>`. */
export function checkOperationName(kind: string, name: string): void {
  if (!operationName.test(name)) {
    throw new Error(`${kind} ${name} is not named <module>.<operation>, such as core.getArticle`);
  }
}

/** Declares a read's contract. A contract without an output schema throws. */
export function defineQueryContract<const Options extends QueryContractOptions>(
  options: Options,
): QueryContract<Options> {
  const { name } = options;
  checkOperationName('Query', name);
  // The types already refuse this; the check covers a contract built without them.
  if (!(options.output instanceof z.ZodType)) {
    throw new Error(
      `Query ${name} has no output schema. Every surface validates a query's answer with it (ADR 0073)`,
    );
  }
  return { ...options, kind: 'query' };
}
