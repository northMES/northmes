// SPDX-License-Identifier: MIT
import { HttpException, HttpStatus } from '@nestjs/common';
import {
  isListQueryContract,
  LIST_DEFAULT_PAGE_SIZE,
  LIST_MAX_PAGE_SIZE,
  type Operation,
  type OperationScope,
  type OperationsDeclaration,
} from '@northmes/contracts';
import { z } from 'zod';
import { DomainError, type FieldError } from '../errors/domain-error.ts';
import { withOutcome } from './outcome.ts';
import { wrapOutsideText } from './tool-output.ts';

/**
 * The surface a call came in on (ADR 0013, ADR 0073): the public REST API, WebMCP in the user's
 * browser, and later /mcp and the in-app assistant.
 */
export type Surface = 'api' | 'webmcp' | 'mcp' | 'assistant';

/** The surfaces whose callers are agents, where the tool output rules apply (ADR 0034). */
const toolSurfaces: ReadonlySet<Surface> = new Set(['webmcp', 'mcp', 'assistant']);

/** The largest first of a list tool call without its own maxPageSize (ADR 0073). */
const TOOL_MAX_PAGE_SIZE = 25;

/** What the runner needs of the host, which resolved the principal before it calls the runner. */
export interface OperationPorts {
  /**
   * The coarse permission gate of step 3: throws core.forbidden unless the principal holds
   * `permission` at the request's plant, or at the company for a request without one, and refuses
   * a call without a plant to an operation whose scope is plant. The command bus checks again at
   * the row's scope.
   */
  authorize(permission: string, scope: OperationScope): void | Promise<void>;
  /** Runs fn so that every ScopedDatabase transaction it opens is read only (step 4). */
  readOnly<Result>(fn: () => Promise<Result>): Promise<Result>;
  /** The personal-field redactor, which runs on every tool answer (step 6, ADR 0034). */
  redact(output: unknown): unknown;
  /** Hears an error that the answer masks as core.internal, for the server's log. */
  report?(error: unknown, correlationId: string): void;
}

/** One call of an operation. */
export interface OperationCall {
  readonly surface: Surface;
  /** The input as the caller sent it, which the contract parses. */
  readonly input: unknown;
  /** The request's correlation id, which a masked error carries. */
  readonly correlationId: string;
}

/** An operation of a declaration with the handler the backend bound to it. */
export interface RunnableOperation {
  readonly declaration: OperationsDeclaration;
  readonly key: string;
  /** Runs the bound handler with an input the contract parsed. */
  handle(input: unknown): Promise<unknown>;
}

/** An error as every surface reports it (ADR 0012, docs/plan/05 error model). */
export interface OperationError {
  readonly status: number;
  /** The module-scoped code, such as core.version_conflict, or core.internal for a masked error. */
  readonly code: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly fieldErrors?: readonly FieldError[];
  readonly correlationId: string;
}

/** A call's answer: the validated output with its status, or the error. */
export type OperationResult =
  | { readonly ok: true; readonly status: 200 | 201; readonly value: unknown }
  | { readonly ok: false; readonly error: OperationError };

/** The code of a Nest HttpException that is not a DomainError, by its status. */
const codesByStatus: Readonly<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'core.invalid_input',
  [HttpStatus.UNAUTHORIZED]: 'core.unauthenticated',
  [HttpStatus.FORBIDDEN]: 'core.forbidden',
  [HttpStatus.NOT_FOUND]: 'core.not_found',
  [HttpStatus.CONFLICT]: 'core.conflict',
  [HttpStatus.PRECONDITION_FAILED]: 'core.precondition',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'core.unavailable',
};

/** A refusal the runner raises itself. */
function refusal(status: 400 | 404, code: string, message: string, fieldErrors?: FieldError[]) {
  return new DomainError({ status, code, message, ...(fieldErrors ? { fieldErrors } : {}) });
}

/**
 * Maps an error once for every surface (step 7): a DomainError keeps its code, status, details
 * and field errors; another HttpException of a status in the error model gets the core code of
 * that status and keeps its message; anything else is core.internal with the correlation id, and
 * the runner reports it.
 */
function toOperationError(
  error: unknown,
  correlationId: string,
  report: OperationPorts['report'],
): OperationError {
  if (error instanceof DomainError) {
    return {
      status: error.getStatus(),
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
      ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
      correlationId,
    };
  }
  if (error instanceof HttpException) {
    const code = codesByStatus[error.getStatus()];
    if (code) return { status: error.getStatus(), code, message: error.message, correlationId };
  }
  report?.(error, correlationId);
  return { status: 500, code: 'core.internal', message: 'Unexpected error.', correlationId };
}

/** The field errors of a Zod failure, with paths relative to the input. */
function fieldErrorsOf(error: z.ZodError): FieldError[] {
  return error.issues.map(({ path, message, code }) => ({
    path: path.map((segment) => (typeof segment === 'symbol' ? String(segment) : segment)),
    message,
    code,
  }));
}

/** Throws unless the operation reaches `surface`. */
function checkSurface(operation: Operation, surface: Surface): void {
  const { name } = operation.contract;
  if (surface === 'api' && !operation.rest) {
    throw refusal(404, 'core.not_found', `${name} has no REST route`);
  }
  if (surface === 'webmcp' && !operation.webmcp) {
    throw refusal(404, 'core.not_found', `${name} has no webmcp tool`);
  }
  if ((surface === 'mcp' || surface === 'assistant') && !operation.tool) {
    throw refusal(404, 'core.not_found', `${name} has no ${surface} tool`);
  }
}

/** Throws core.list.bad_argument when a list call asks for more rows than its surface allows. */
function checkPageSize(operation: Operation, surface: Surface, input: unknown): void {
  if (!isListQueryContract(operation.contract)) return;
  const binding = surface === 'api' ? operation.rest : operation.tool;
  const fallback = surface === 'api' ? LIST_MAX_PAGE_SIZE : TOOL_MAX_PAGE_SIZE;
  const max = (binding ? binding.maxPageSize : undefined) ?? fallback;
  const first = (input as { first?: number }).first ?? LIST_DEFAULT_PAGE_SIZE;
  if (first > max) {
    throw refusal(400, 'core.list.bad_argument', `first must be between 1 and ${max}`);
  }
}

/** The answer of a successful call, with the status of its REST binding. */
function statusOf(operation: Operation, created: boolean): 200 | 201 {
  return operation.rest && operation.rest.status === 201 && created ? 201 : 200;
}

/**
 * Runs one call of an operation, from any surface, after the host resolved its principal and plant
 * (ADR 0073, step 1). It parses the input with the contract (step 2), checks the operation's
 * permission as a coarse gate (step 3), runs the handler, read only for a query (step 4), encodes
 * the answer with the output schema, which drops every key outside it (step 5), applies the tool
 * output rules on a tool surface (step 6), and maps any error once (step 7). An operation that
 * does not reach the surface is core.not_found, and a list call above the surface's page size is
 * core.list.bad_argument.
 */
export async function runOperation(
  runnable: RunnableOperation,
  { surface, input, correlationId }: OperationCall,
  ports: OperationPorts,
): Promise<OperationResult> {
  const { declaration, key } = runnable;
  const operation = declaration.operations[key] as Operation | undefined;
  try {
    if (!operation) {
      throw refusal(
        404,
        'core.not_found',
        `${declaration.module}.${declaration.resource} has no operation ${key}`,
      );
    }
    checkSurface(operation, surface);
    const { contract } = operation;
    const parsed = contract.input.safeParse(input);
    if (!parsed.success) {
      throw refusal(
        400,
        'core.invalid_input',
        `Invalid input for ${contract.name}`,
        fieldErrorsOf(parsed.error),
      );
    }
    checkPageSize(operation, surface, parsed.data);
    await ports.authorize(contract.permission, declaration.scope);
    const isQuery = 'kind' in contract && contract.kind === 'query';
    const run = () => runnable.handle(parsed.data);
    const { result, created } = await withOutcome(() => (isQuery ? ports.readOnly(run) : run()));
    const encoded: unknown = z.encode(operation.output, result);
    const value = toolSurfaces.has(surface)
      ? ports.redact(wrapOutsideText(operation.output, encoded))
      : encoded;
    return { ok: true, status: statusOf(operation, created), value };
  } catch (error) {
    return { ok: false, error: toOperationError(error, correlationId, ports.report) };
  }
}
