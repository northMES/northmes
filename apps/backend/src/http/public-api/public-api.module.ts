// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { type DynamicModule, Inject, Injectable, Logger, Module, type Type } from '@nestjs/common';
import {
  type OperationResult,
  type OperationsDeclaration,
  operationError,
} from '@northmes/sdk/operations';
import { type PublicOperationCall, PublicOperationRunner, toRestRoutes } from '@northmes/sdk/rest';
import type { DiscoveredOperation } from '../../operations/discover-operations.ts';
import { OperationRunner } from '../../operations/operation-runner.ts';
import type { Principal } from '../../principal.ts';
import { BearerPublicApiCredentials, PublicApiCredentials } from './public-api-credentials.ts';
import { PostgresThrottlerStorage, PublicApiRateLimit } from './public-api-rate-limit.ts';

/**
 * The host's side of the public routes (ADR 0073): it resolves a call's principal through the
 * public family's credential guard, never through the web's PrincipalResolver, counts the call
 * against the credential's rate limit, a GET as a read and a POST as a write, and runs the
 * operation through the operation runner with surface api.
 */
@Injectable()
export class PublicApiRunner extends PublicOperationRunner {
  readonly #logger = new Logger('PublicApi');

  constructor(
    @Inject(OperationRunner) private readonly runner: OperationRunner,
    @Inject(PublicApiCredentials) private readonly credentials: PublicApiCredentials,
    @Inject(PublicApiRateLimit) private readonly rateLimit: PublicApiRateLimit,
  ) {
    super();
  }

  async run({
    operation,
    method,
    input,
    headers,
    plant,
    correlationId,
  }: PublicOperationCall): Promise<OperationResult> {
    const report = (cause: unknown, id: string) =>
      this.#logger.error(
        `The credential of a call of ${operation} failed with correlation id ${id}`,
        cause instanceof Error ? cause.stack : String(cause),
      );
    let principal: Principal | null;
    try {
      principal = await this.credentials.resolve({ headers, plant });
      if (principal) await this.rateLimit.check(principal, method === 'GET' ? 'reads' : 'writes');
    } catch (error) {
      return { ok: false, error: operationError(error, correlationId, report) };
    }
    if (!principal) {
      return {
        ok: false,
        error: {
          status: 401,
          code: 'core.unauthenticated',
          message: 'Send a credential of the public API in the Authorization header',
          correlationId,
        },
      };
    }
    return this.runner.run({ surface: 'api', operation, input, principal, correlationId });
  }
}

/** The declarations of each module among the bound operations that reach REST, by module id. */
function restDeclarationsByModule(
  operations: ReadonlyMap<string, DiscoveredOperation>,
): Map<string, OperationsDeclaration[]> {
  const byModule = new Map<string, OperationsDeclaration[]>();
  for (const { provider } of operations.values()) {
    const { declaration } = provider;
    if (!Object.values(declaration.operations).some((operation) => operation.rest)) continue;
    const declarations = byModule.get(declaration.module) ?? [];
    if (!declarations.includes(declaration)) declarations.push(declaration);
    byModule.set(declaration.module, declarations);
  }
  return byModule;
}

/** Serves the public REST family (ADR 0064, ADR 0073). */
@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: Nest knows a module by its decorated class.
export class PublicApiModule {
  /**
   * One public controller per module, which toRestRoutes builds from the operations the module
   * binds, and the runner its routes call. `credentials` is the public family's credential guard:
   * the server's BearerPublicApiCredentials, which verifies integration tokens, unless a test passes
   * its own.
   */
  static forRoot(
    operations: ReadonlyMap<string, DiscoveredOperation>,
    credentials: Type<PublicApiCredentials> = BearerPublicApiCredentials,
  ): DynamicModule {
    const controllers = [...restDeclarationsByModule(operations).values()].map((declarations) =>
      toRestRoutes(declarations),
    );
    return {
      module: PublicApiModule,
      controllers,
      providers: [
        { provide: PublicApiCredentials, useClass: credentials },
        { provide: PublicOperationRunner, useClass: PublicApiRunner },
        PostgresThrottlerStorage,
        PublicApiRateLimit,
      ],
    };
  }
}
