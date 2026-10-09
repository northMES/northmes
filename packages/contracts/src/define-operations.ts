// SPDX-License-Identifier: MIT
import type { z } from 'zod';
import type { CommandContract } from './define-command-contract.ts';
import { isListQueryContract, LIST_MAX_PAGE_SIZE } from './define-list-query-contract.ts';
import type { QueryContract } from './define-query-contract.ts';

/**
 * Where an operation runs (ADR 0073): plant needs a plant, company takes none, and
 * companyOrPlant takes an optional plant and runs at the company without one.
 */
export type OperationScope = 'plant' | 'company' | 'companyOrPlant';

/** How an operation reaches the public REST API (ADR 0064, ADR 0073). */
export interface RestBinding {
  readonly method: 'GET' | 'POST';
  /**
   * The path under the module segment /api/v1/<module>/, such as articles/{id} or
   * commands/create-article.
   */
  readonly path: string;
  /** 200, or 201 for an operation that may create, which answers 200 when the row exists. */
  readonly status: 200 | 201;
  /** For a list: the largest first a REST call may send, 100 by default. */
  readonly maxPageSize?: number;
}

/** How an operation reaches the agent surfaces as a tool (ADR 0034, ADR 0073). */
export interface ToolBinding {
  /** `<module>_<tool>`, such as core_get_article. The tool belongs to its module's toolset. */
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly annotations: { readonly readOnlyHint: boolean; readonly destructiveHint: boolean };
  /** read for a query; proposal for a command an agent proposes and a person commits. */
  readonly effect: 'read' | 'proposal';
  /**
   * For a list: the largest first a tool call may send, 25 by default, so two outside text fields
   * per row stay within 50 values per call.
   */
  readonly maxPageSize?: number;
}

/** One operation of a resource as its module declares it. */
export type OperationEntry =
  | {
      readonly contract: QueryContract;
      readonly rest: RestBinding | false;
      readonly tool: ToolBinding | false;
      /** Registers the tool in the browser through WebMCP; false by default. */
      readonly webmcp?: boolean;
    }
  | {
      readonly contract: CommandContract;
      /**
       * What the command answers, such as the entity it changed. The runner validates the answer
       * with it, as it does a query's output.
       */
      readonly output: z.ZodType;
      readonly rest: RestBinding | false;
      readonly tool: ToolBinding | false;
      readonly webmcp?: boolean;
    };

export interface OperationsOptions<Operations extends Readonly<Record<string, OperationEntry>>> {
  /** The module's id, such as core: the REST segment, the tool prefix and the toolset. */
  readonly module: string;
  /** The resource the operations act on, such as articles. */
  readonly resource: string;
  readonly scope: OperationScope;
  readonly operations: Operations;
}

/** The output schema of an entry: the query's, or the one a command entry names. */
type OutputOf<Entry extends OperationEntry> = Entry extends { readonly output: infer Output }
  ? Output
  : Entry['contract'] extends { readonly output: infer Output }
    ? Output
    : never;

/** An operation as defineOperations resolves it: with its output schema and webmcp. */
export type Operation<Entry extends OperationEntry = OperationEntry> = Omit<
  Entry,
  'output' | 'webmcp'
> & {
  readonly output: OutputOf<Entry> & z.ZodType;
  readonly webmcp: boolean;
};

/** One resource's operations, plain data that the backend binds and every adapter reads. */
export interface OperationsDeclaration<
  Operations extends Readonly<Record<string, OperationEntry>> = Readonly<
    Record<string, OperationEntry>
  >,
> {
  readonly module: string;
  readonly resource: string;
  readonly scope: OperationScope;
  readonly operations: { readonly [Key in keyof Operations]: Operation<Operations[Key]> };
}

/** A path segment under the module segment: lowercase words with hyphens, or a {parameter}. */
const pathSegment = /^(?:[a-z0-9]+(?:-[a-z0-9]+)*|\{[a-z][a-zA-Z0-9]*\})$/;

/** The rules of one operation, as messages; empty when it keeps them all. */
function problemsOf(module: string, entry: OperationEntry): string[] {
  const { contract, rest, tool, webmcp } = entry;
  const problems: string[] = [];
  if (!contract.name.startsWith(`${module}.`)) {
    problems.push(`contract ${contract.name} is not of module ${module}`);
  }
  const isQuery = 'kind' in contract && contract.kind === 'query';
  if (!isQuery && !('output' in entry && entry.output)) {
    problems.push(`command ${contract.name} needs output, the schema of what it answers`);
  }
  if (rest && !rest.path.split('/').every((segment) => pathSegment.test(segment))) {
    problems.push(
      `REST path ${JSON.stringify(rest.path)} is not under the module segment /api/v1/${module}/: use lowercase segments with hyphens or {parameters}, without a leading /`,
    );
  }
  if (tool && !tool.name.startsWith(`${module}_`)) {
    problems.push(`tool name ${tool.name} does not start with ${module}_`);
  }
  if (tool && tool.effect !== (isQuery ? 'read' : 'proposal')) {
    problems.push(
      `a ${isQuery ? 'query' : 'command'}'s tool has effect ${isQuery ? 'read' : 'proposal'}`,
    );
  }
  if (webmcp && !tool) problems.push('webmcp needs a tool');
  if (webmcp && tool && tool.effect !== 'read') {
    problems.push('WebMCP registers read tools only (ADR 0073)');
  }
  for (const maxPageSize of [
    rest ? rest.maxPageSize : undefined,
    tool ? tool.maxPageSize : undefined,
  ]) {
    if (maxPageSize === undefined) continue;
    if (!isListQueryContract(contract)) {
      problems.push('maxPageSize needs a list query');
    } else if (
      !Number.isInteger(maxPageSize) ||
      maxPageSize < 1 ||
      maxPageSize > LIST_MAX_PAGE_SIZE
    ) {
      problems.push(`maxPageSize ${maxPageSize} is not between 1 and ${LIST_MAX_PAGE_SIZE}`);
    }
  }
  return problems;
}

/**
 * Declares the operations of one resource: each with its contract and the surfaces it reaches,
 * REST, a tool and WebMCP (ADR 0073). The declaration is plain data, so the backend, the web app
 * and the OpenAPI printer read the same object. An operation that breaks a rule throws, naming it
 * as `<module>.<resource>.<operation>`: a contract of another module, a command without output, a
 * REST path outside the module segment, a tool name without the module prefix, a tool whose effect
 * does not fit its contract, webmcp without a read tool, and a maxPageSize on anything but a list
 * or outside 1 to 100.
 */
export function defineOperations<const Operations extends Readonly<Record<string, OperationEntry>>>(
  options: OperationsOptions<Operations>,
): OperationsDeclaration<Operations> {
  const { module, resource } = options;
  const problems = Object.entries(options.operations).flatMap(([key, entry]) =>
    problemsOf(module, entry).map(
      (problem) => `Operation ${module}.${resource}.${key}: ${problem}`,
    ),
  );
  if (problems.length > 0) throw new Error(problems.join('\n'));
  const operations = Object.fromEntries(
    Object.entries(options.operations).map(([key, entry]) => {
      const output = 'output' in entry ? entry.output : (entry.contract as QueryContract).output;
      return [key, { ...entry, output, webmcp: entry.webmcp ?? false }];
    }),
  );
  return { ...options, operations } as OperationsDeclaration<Operations>;
}
