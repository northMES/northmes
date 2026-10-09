// SPDX-License-Identifier: MIT
import type {
  Operation,
  OperationResult,
  OperationsDeclaration,
  Surface,
} from '@northmes/sdk/operations';
import { describe, expect, it } from 'vitest';

/** One call that the conformance test asks the module's harness to make. */
export interface ConformanceCall {
  /** The operation's key in the declaration, such as get. */
  readonly key: string;
  readonly surface: Surface;
  /**
   * true: as a principal who holds the operation's permission where the call runs; false: as one
   * who holds none of it there.
   */
  readonly permitted: boolean;
}

export interface OperationsConformanceOptions {
  /** The story id that starts each test name, such as ADR0073-W3. */
  readonly story: string;
  /**
   * Runs one operation through the host's operation runner with an input that fits it, such as an
   * article that a fixture wrote for a get, as the principal the call names.
   */
  run(call: ConformanceCall): Promise<OperationResult>;
}

/** The surfaces an operation reaches that the runner serves so far: REST and WebMCP. */
function surfacesOf(operation: Operation): Surface[] {
  return [
    ...(operation.rest ? (['api'] as const) : []),
    ...(operation.webmcp ? (['webmcp'] as const) : []),
  ];
}

/**
 * The conformance test of one resource's operations (ADR 0073). For every surface each operation
 * reaches, it checks that the operation runs through the operation runner for a principal who holds
 * its permission, with the status its REST binding names or 200, and that it is refused with 403
 * core.forbidden for one who does not. Call it in the body of a describe of the module's tests.
 */
export function operationsConformance(
  declaration: OperationsDeclaration,
  options: OperationsConformanceOptions,
): void {
  const { module, resource } = declaration;
  describe(`the operations of ${module}.${resource}`, () => {
    for (const [key, operation] of Object.entries(declaration.operations)) {
      const { permission } = operation.contract;
      for (const surface of surfacesOf(operation)) {
        const name = `${module}.${resource}.${key} on ${surface}`;

        it(`${options.story} ${name} runs for a principal who holds ${permission}`, async () => {
          const result = await options.run({ key, surface, permitted: true });

          if (!result.ok) {
            throw new Error(`${name} answered ${result.error.code}: ${result.error.message}`);
          }
          const statuses = [200, operation.rest ? operation.rest.status : 200];
          expect(statuses).toContain(result.status);
        });

        it(`${options.story} ${name} is refused for a principal without ${permission}`, async () => {
          const result = await options.run({ key, surface, permitted: false });

          expect(result).toMatchObject({
            ok: false,
            error: { status: 403, code: 'core.forbidden' },
          });
        });
      }
    }
  });
}
