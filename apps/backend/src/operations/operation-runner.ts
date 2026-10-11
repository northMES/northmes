// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomUUID } from 'node:crypto';
import { HttpStatus, Logger } from '@nestjs/common';
import type { ModuleRef } from '@nestjs/core';
import { DomainError } from '@northmes/sdk/errors';
import {
  type BoundOperations,
  type OperationPorts,
  type OperationResult,
  type OperationScope,
  operationError,
  runOperation,
  type Surface,
} from '@northmes/sdk/operations';
import { readOnly } from '../db/scoped-database.ts';
import { can } from '../modules/core/core/access/access.ts';
import { type Principal, PrincipalResolver, runAs } from '../principal.ts';
import type { DiscoveredOperation } from './discover-operations.ts';

/** One call of an operation as an adapter hands it to the runner. */
export interface OperationRun {
  readonly surface: Surface;
  /** The operation's contract name, such as core.getArticle. */
  readonly operation: string;
  /** The input as the caller sent it, which the contract parses. */
  readonly input: unknown;
  /** The request's headers, from which the runner resolves its principal and plant. */
  readonly headers: Headers;
  /**
   * The company a request without a plant acts at, which the adapter takes from outside the
   * input, such as the company of a public API credential (ADR 0073). A request at a plant acts at
   * the plant's company and ignores it.
   */
  readonly companyId?: string;
  /** The request's correlation id; the runner makes one when the adapter has none. */
  readonly correlationId?: string;
}

function refusal(
  status:
    | HttpStatus.UNAUTHORIZED
    | HttpStatus.FORBIDDEN
    | HttpStatus.NOT_FOUND
    | HttpStatus.BAD_REQUEST,
  code: string,
  message: string,
) {
  return new DomainError({ status, code, message });
}

/**
 * The permission gate of the runner's step 3 (ADR 0073): the principal must hold the permission at
 * the request's plant, or at the company it acts at without one. An operation whose scope is plant
 * needs a plant. The command bus and the service check again where the row is.
 */
function authorizeAs(principal: Principal): OperationPorts['authorize'] {
  return (permission: string, scope: OperationScope) => {
    const { plantId, companyId } = principal;
    if (plantId === undefined && scope === 'plant') {
      throw refusal(
        HttpStatus.BAD_REQUEST,
        'core.plant_required',
        `${permission} runs at a plant, and the request names none`,
      );
    }
    const at = plantId ?? companyId;
    if (at === undefined) {
      throw refusal(
        HttpStatus.FORBIDDEN,
        'core.forbidden',
        `The request names no plant and no company, so it cannot use ${permission}`,
      );
    }
    if (!can(principal, permission, at)) {
      throw refusal(
        HttpStatus.FORBIDDEN,
        'core.forbidden',
        `You need ${permission} at ${plantId ? 'plant' : 'company'} ${at}`,
      );
    }
  };
}

/**
 * The operation runner of the host (ADR 0073), which the REST and WebMCP adapters call, and the
 * /mcp and assistant adapters later. It resolves the principal and plant of a call through the core
 * module's PrincipalResolver (step 1), and then runs the operation's bound handler through the
 * SDK's runOperation as that principal: input parsing, the permission gate, read-only queries,
 * output validation, the tool output rules and the error mapping.
 */
export class OperationRunner {
  readonly #logger = new Logger('OperationRunner');
  readonly #moduleRef: ModuleRef;
  readonly #operations: ReadonlyMap<string, DiscoveredOperation>;

  constructor(moduleRef: ModuleRef, operations: ReadonlyMap<string, DiscoveredOperation>) {
    this.#moduleRef = moduleRef;
    this.#operations = operations;
  }

  /** Every bound operation by its contract name, which an adapter builds its routes or tools from. */
  operations(): ReadonlyMap<string, DiscoveredOperation> {
    return this.#operations;
  }

  /** Runs one call and answers its validated output with its status, or its mapped error. */
  async run({
    surface,
    operation,
    input,
    headers,
    companyId,
    correlationId = randomUUID(),
  }: OperationRun): Promise<OperationResult> {
    const report = (error: unknown, id: string) =>
      this.#logger.error(
        `Operation ${operation} failed with correlation id ${id}`,
        error instanceof Error ? error.stack : String(error),
      );
    let principal: Principal;
    let found: DiscoveredOperation;
    try {
      const discovered = this.#operations.get(operation);
      if (!discovered) {
        throw refusal(
          HttpStatus.NOT_FOUND,
          'core.not_found',
          `No module binds the operation ${operation}`,
        );
      }
      found = discovered;
      const resolved = await this.#resolver()?.resolve(headers);
      if (!resolved) {
        throw refusal(HttpStatus.UNAUTHORIZED, 'core.unauthenticated', 'Sign in to use the API');
      }
      principal =
        resolved.plantId === undefined && companyId !== undefined
          ? { ...resolved, companyId }
          : resolved;
    } catch (error) {
      return { ok: false, error: operationError(error, correlationId, report) };
    }
    const bound = this.#moduleRef.get<BoundOperations>(found.provider, { strict: false });
    const ports: OperationPorts = {
      authorize: authorizeAs(principal),
      readOnly,
      // No module declares personal fields yet, so the manifest-driven redactor has none to remove.
      redact: (output) => output,
      report,
    };
    return runAs(principal, () =>
      runOperation(
        {
          declaration: found.provider.declaration,
          key: found.key,
          handle: (parsed) => bound.handle(found.key, parsed),
        },
        { surface, input, correlationId },
        ports,
      ),
    );
  }

  /** The core module's PrincipalResolver, or undefined in an app without core. */
  #resolver(): PrincipalResolver | undefined {
    try {
      return this.#moduleRef.get(PrincipalResolver, { strict: false });
    } catch {
      return undefined;
    }
  }
}
