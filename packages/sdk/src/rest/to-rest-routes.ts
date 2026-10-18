// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { randomUUID } from 'node:crypto';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  Get,
  HttpStatus,
  Inject,
  Logger,
  Post,
  Req,
  Res,
  type Type,
  UseFilters,
} from '@nestjs/common';
import {
  API_MAJOR,
  type CommandTarget,
  type Operation,
  type OperationsDeclaration,
} from '@northmes/contracts';
import type { z } from 'zod';
import { DomainError } from '../errors/domain-error.ts';
import { type OperationResult, operationError } from '../operations/runner.ts';
import { ApiController } from './api-controller.ts';
import { PROBLEM_CONTENT_TYPE, type Problem, problemOf } from './problem.ts';
import { operationIdOf, type ProblemStatus, PublicApiOperation } from './public-api-operation.ts';

/** One call of a public API route, as toRestRoutes hands it to the host. */
export interface PublicOperationCall {
  /** The operation's contract name, such as core.getArticle. */
  readonly operation: string;
  /**
   * The route's method: GET for a query, which counts as a read, and POST for a command, which
   * counts as a write, as the host's rate limits count them (ADR 0073 section 6).
   */
  readonly method: 'GET' | 'POST';
  /** The input as the request carries it: the query and path parameters, or the body. */
  readonly input: unknown;
  /** The request's headers, from which the host's credential guard resolves its principal. */
  readonly headers: Headers;
  /**
   * The slug of the plant the request names in its plant query parameter, or undefined for a
   * request that acts at the company of its credential (ADR 0073).
   */
  readonly plant: string | undefined;
  /** The request's correlation id, which a problem response carries. */
  readonly correlationId: string;
}

/**
 * The port through which the routes of toRestRoutes reach the host: it resolves the principal of
 * the public API's credential, then runs the operation through the host's operation runner with
 * surface api (ADR 0073). The host provides it; a module never does.
 */
export abstract class PublicOperationRunner {
  abstract run(call: PublicOperationCall): Promise<OperationResult>;
}

/** The parts of an Express request that a route reads. */
interface RouteRequest {
  readonly headers: Readonly<Record<string, string | readonly string[] | undefined>>;
  readonly query: Readonly<Record<string, unknown>>;
  readonly params: Readonly<Record<string, string>>;
  readonly body: unknown;
  readonly originalUrl: string;
}

/** The parts of an Express response that a route writes. */
interface RouteResponse {
  status(code: number): unknown;
  setHeader(name: string, value: string): unknown;
  end(body: string): unknown;
}

/**
 * The full path of a public REST binding in OpenAPI form: the version, the module segment and the
 * binding's path, so publicApiPath('core', 'articles/{id}') is /api/v1/core/articles/{id}.
 */
export function publicApiPath(module: string, path: string): string {
  return `/api/v${API_MAJOR}/${module}/${path}`;
}

/** The query parameter that names the request's plant, which no operation's input may use. */
const PLANT_PARAMETER = 'plant';

const logger = new Logger('PublicApi');

/** The path of a request without its query, the problem's instance. */
function pathOf(request: RouteRequest): string {
  return new URL(request.originalUrl, 'http://localhost').pathname;
}

/** The headers of an Express request as fetch Headers. */
function headersOf(request: RouteRequest): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    for (const one of [value ?? []].flat()) headers.append(name, one);
  }
  return headers;
}

function send(response: RouteResponse, status: number, contentType: string, body: unknown): void {
  response.status(status);
  response.setHeader('content-type', `${contentType}; charset=utf-8`);
  response.end(JSON.stringify(body));
}

/**
 * Sends a problem. A 429 problem whose details hold retryAfterSeconds, such as the host's
 * core.request.rate_limited, also sends it as the Retry-After header (RFC 9110).
 */
function sendProblem(response: RouteResponse, problem: Problem): void {
  const retryAfter = problem.details?.retryAfterSeconds;
  if (problem.status === 429 && typeof retryAfter === 'number') {
    response.setHeader('retry-after', String(retryAfter));
  }
  send(response, problem.status, PROBLEM_CONTENT_TYPE, problem);
}

/** Logs an error that a problem masks as core.internal. */
function report(error: unknown, correlationId: string): void {
  logger.error(
    `Public API request failed with correlation id ${correlationId}`,
    error instanceof Error ? error.stack : String(error),
  );
}

/**
 * Answers every exception that escapes a public route, such as one a guard throws, as a problem
 * response, so no error of the public API has another shape.
 */
@Catch()
class PublicApiProblemFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const error = operationError(exception, randomUUID(), report);
    sendProblem(http.getResponse<RouteResponse>(), problemOf(error, pathOf(http.getRequest())));
  }
}

/** The definition of a Zod schema, as far as the query coercion reads it. */
interface Def {
  readonly type: string;
  readonly innerType?: z.core.$ZodType;
}

/** The kind of value a field of the input takes, past optional, nullable and default. */
function kindOf(schema: z.core.$ZodType | undefined): string | undefined {
  let current = schema;
  while (current) {
    const def = current._zod.def as unknown as Def;
    if (!['optional', 'nullable', 'default'].includes(def.type)) return def.type;
    current = def.innerType;
  }
  return undefined;
}

/**
 * One query parameter as the input field takes it: a number for a number field, true or false for
 * a boolean, a comma-separated list for an array (ADR 0073), and the text for anything else. A
 * value that does not convert stays text, so the contract refuses it with a field error.
 */
function fromQuery(kind: string | undefined, value: unknown): unknown {
  const texts = [value].flat().filter((one): one is string => typeof one === 'string');
  if (kind === 'array') return texts.flatMap((text) => text.split(','));
  if (typeof value !== 'string') return value;
  if (kind === 'number' && /^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  if (kind === 'boolean' && (value === 'true' || value === 'false')) return value === 'true';
  return value;
}

/** The input of a GET route: its query parameters, without plant, and its path parameters. */
function queryInput(operation: Operation, request: RouteRequest): Record<string, unknown> {
  const shape = (operation.contract.input as z.ZodObject).shape as Readonly<
    Record<string, z.core.$ZodType>
  >;
  const input: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(request.query)) {
    if (key === PLANT_PARAMETER) continue;
    input[key] = fromQuery(kindOf(shape[key]), value);
  }
  return { ...input, ...request.params };
}

/** The plant query parameter of a request, which names one plant or none. */
function plantOf(request: RouteRequest): string | undefined {
  const plant = request.query[PLANT_PARAMETER];
  if (plant === undefined || typeof plant === 'string') return plant;
  throw new DomainError({
    status: HttpStatus.BAD_REQUEST,
    code: 'core.invalid_input',
    message: 'plant names one plant by its slug',
    fieldErrors: [
      { path: [PLANT_PARAMETER], message: 'Name one plant by its slug.', code: 'invalid_type' },
    ],
  });
}

/** A path under the module segment in Nest's form: articles/{id} becomes articles/:id. */
function nestPath(path: string): string {
  return path.replace(/\{([a-zA-Z0-9]+)\}/g, ':$1');
}

/**
 * The problem statuses a route may answer. Every route answers 400 for an input or a plant its
 * contract refuses, 401 without a credential of the public API, 403 without the permission or the
 * plant, and 429 over the credential's rate limit (ADR 0073). A read by a path parameter answers
 * 404 for a row it does not find. A command answers 409 for a stale version or a taken code, one
 * on an existing row 404 when the row is missing, and one that may change a row, so every command
 * except a create, 412 when that row is archived.
 */
function problemsOf(operation: Operation, path: string): ProblemStatus[] {
  const contract = operation.contract as {
    readonly kind?: string;
    readonly target?: CommandTarget;
  };
  const statuses: ProblemStatus[] = [400, 401, 403];
  if (contract.kind === 'query') {
    if (path.includes('{')) statuses.push(404);
  } else {
    if (contract.target === 'existing') statuses.push(404);
    statuses.push(409);
    if (contract.target !== 'new') statuses.push(412);
  }
  statuses.push(429);
  return statuses;
}

/** One route of an operation: its handler and what it records. */
interface Route {
  readonly key: string;
  readonly operation: Operation;
  readonly operationId: string;
  readonly method: 'GET' | 'POST';
  readonly path: string;
  readonly status: 200 | 201;
}

/** The routes of a module's declarations, or the problems that stop them. */
function routesOf(module: string, declarations: readonly OperationsDeclaration[]): Route[] {
  const problems: string[] = [];
  const routes: Route[] = [];
  for (const declaration of declarations) {
    const { resource, scope } = declaration;
    if (declaration.module !== module) {
      problems.push(
        `${declaration.module}.${resource} is not of module ${module}; toRestRoutes builds one module's routes`,
      );
      continue;
    }
    for (const [key, operation] of Object.entries(declaration.operations)) {
      const { rest } = operation;
      if (!rest) continue;
      const name = `${module}.${resource}.${key}`;
      if (scope === 'plant') {
        problems.push(
          `${name} runs at a plant, which takes the plant as the path segment /plants/{plant}/ (ADR 0064); toRestRoutes serves company and companyOrPlant operations so far`,
        );
        continue;
      }
      const shape = (operation.contract.input as z.ZodObject).shape;
      if (PLANT_PARAMETER in shape) {
        problems.push(`${name}: the input field plant is the plant query parameter of every route`);
      }
      routes.push({
        key: `${resource}.${key}`,
        operation,
        operationId: operationIdOf(operation.contract),
        method: rest.method,
        path: rest.path,
        status: rest.status,
      });
    }
  }
  const seen = new Map<string, string>();
  for (const route of routes) {
    for (const id of [`${route.method} ${route.path}`, route.operationId]) {
      const first = seen.get(id);
      if (first) problems.push(`${first} and ${route.key} share ${id}`);
      else seen.set(id, route.key);
    }
  }
  if (problems.length > 0) throw new Error(problems.join('\n'));
  return routes;
}

/** Upper camel case of a module id, such as core or work-centers. */
function pascal(id: string): string {
  return id
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/** The controllers that toRestRoutes built, which only this module can add to. */
const builtControllers = new WeakSet<object>();

/**
 * Whether toRestRoutes built the controller. The host's guard lets only such a controller's routes
 * through without the web's credential, because they resolve their principal through the
 * PublicOperationRunner; a hand-written controller that copies their metadata is no such route.
 */
export function isBuiltByToRestRoutes(controller: unknown): boolean {
  return typeof controller === 'function' && builtControllers.has(controller);
}

/**
 * Builds the public REST routes of one module's operation declarations (ADR 0064, ADR 0073): one
 * controller in the public family of ApiController, with a route for every operation that names a
 * REST binding. A query is served at GET /api/v1/<module>/<path>, with its query parameters and its
 * path parameters, such as {id}, as its input; a command at POST /api/v1/<module>/<path>, with the
 * body as its input. The optional query parameter plant names the request's plant by its slug. Each
 * handler carries PublicApiOperation, whose operation id is the GraphQL field that calls the same
 * service method, and hands the call to the host's PublicOperationRunner. The answer is the
 * runner's validated output with the status it names; every error, also one a guard throws, is
 * application/problem+json (docs/plan/05, REST errors). Declarations of another module, a
 * plant-scoped operation, an input field named plant, and two routes on one method and path or with
 * one operation id throw.
 */
export function toRestRoutes(declarations: readonly OperationsDeclaration[]): Type {
  const module = declarations[0]?.module;
  if (module === undefined) throw new Error('toRestRoutes needs at least one declaration');
  const routes = routesOf(module, declarations);

  class PublicRoutes {
    constructor(@Inject(PublicOperationRunner) readonly runner: PublicOperationRunner) {}
  }

  for (const route of routes) {
    const { operation, operationId, method, path, status } = route;
    async function handle(
      this: PublicRoutes,
      request: RouteRequest,
      response: RouteResponse,
    ): Promise<void> {
      const correlationId = randomUUID();
      let result: OperationResult;
      try {
        const plant = plantOf(request);
        const input = method === 'GET' ? queryInput(operation, request) : request.body;
        result = await this.runner.run({
          operation: operation.contract.name,
          method,
          input,
          headers: headersOf(request),
          plant,
          correlationId,
        });
      } catch (error) {
        result = { ok: false, error: operationError(error, correlationId, report) };
      }
      if (result.ok) send(response, result.status, 'application/json', result.value);
      else sendProblem(response, problemOf(result.error, pathOf(request)));
    }
    Object.defineProperty(handle, 'name', { value: operationId });
    Object.defineProperty(PublicRoutes.prototype, operationId, {
      value: handle,
      writable: true,
      configurable: true,
    });
    const descriptor = Object.getOwnPropertyDescriptor(
      PublicRoutes.prototype,
      operationId,
    ) as PropertyDescriptor;
    const verb = method === 'GET' ? Get(nestPath(path)) : Post(nestPath(path));
    verb(PublicRoutes.prototype, operationId, descriptor);
    const { description } = operation.contract as { readonly description?: string };
    PublicApiOperation({
      operationId,
      operation: operation.contract.name,
      permission: operation.contract.permission,
      method,
      path: publicApiPath(module, path),
      status,
      tag: module,
      ...(description ? { description } : {}),
      input: operation.contract.input,
      output: operation.output,
      problems: problemsOf(operation, path),
    })(PublicRoutes.prototype, operationId, descriptor);
    Req()(PublicRoutes.prototype, operationId, 0);
    Res()(PublicRoutes.prototype, operationId, 1);
  }
  ApiController({ module, family: 'public' })(PublicRoutes);
  UseFilters(new PublicApiProblemFilter())(PublicRoutes);
  // Nest's messages and the route inventory name the class, so it carries the module.
  Object.defineProperty(PublicRoutes, 'name', { value: `${pascal(module)}PublicApiController` });
  builtControllers.add(PublicRoutes);
  return PublicRoutes;
}
