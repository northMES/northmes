// SPDX-License-Identifier: MIT
import { z } from 'zod';
import { checkOperationName, type QueryContract } from './define-query-contract.ts';

/** Any Zod object schema, whatever its unknown-key mode. */
type ObjectSchema = z.ZodObject<z.core.$ZodShape, z.core.$ZodObjectConfig>;

/** The column behind a sort field: its name in the list's query and its Postgres type. */
export interface ListSortColumn {
  readonly column: string;
  /** The type a cursor's text value is cast back to, such as text or timestamptz. */
  readonly type: string;
}

/** One entry of a list's order: a sort field, or the field prefixed with - for descending. */
export type ListOrder<SortField extends string> = SortField | `-${SortField}`;

/**
 * A list's declaration, plain data in the module's contracts package: its node schema, sort
 * fields, filter fields, search fields and whether its rows are archived (ADR 0016, ADR 0073). The
 * backend's defineList reads it for the GraphQL connection, and defineListQueryContract derives
 * the list's operation from it.
 */
export interface ListDeclaration<
  SortField extends string = string,
  Node extends ObjectSchema = ObjectSchema,
  Filters extends Readonly<Record<string, z.ZodType>> = Readonly<Record<string, z.ZodType>>,
> {
  /**
   * The GraphQL name of the node type, such as Article. The list kit names the connection's
   * types after it: ArticleConnection, ArticleEdge, ArticleSortField and ArticleOrderBy.
   */
  readonly name: string;
  /** What one row of the list answers. */
  readonly node: Node;
  /**
   * The sort fields by their camelCase names, such as updatedAt, with the column behind each.
   * Each column is NOT NULL (ADR 0016). GraphQL names them in upper snake case, such as UPDATED_AT.
   */
  readonly sortFields: Readonly<Record<SortField, ListSortColumn>>;
  /** The order of a call without orderBy. */
  readonly defaultOrderBy: readonly ListOrder<NoInfer<SortField>>[];
  /**
   * The filter fields by name, each with the schema of the value a call compares for equality. The
   * module's service applies them, since a filter such as unassigned reads more than a column.
   */
  readonly filters?: Filters;
  /** The text columns that search matches a part of, ignoring case. */
  readonly search: readonly string[];
  /** The rows are archived through archived_at, never deleted (ADR 0006). */
  readonly archivable?: boolean;
}

/** The page size of a list call: default 25, at most 100 (ADR 0016). */
export const LIST_DEFAULT_PAGE_SIZE = 25;
export const LIST_MAX_PAGE_SIZE = 100;
/** The most orderBy entries a call may send, and the longest search. */
const MAX_ORDER_BY_ENTRIES = 3;
const MAX_SEARCH_LENGTH = 100;

const camelCase = /^[a-z][a-zA-Z0-9]*$/;

/** Declares a list. A sort field whose name is not camelCase, or an empty default order, throws. */
export function defineListDeclaration<
  const SortField extends string,
  Node extends ObjectSchema,
  Filters extends Readonly<Record<string, z.ZodType>> = Readonly<Record<never, z.ZodType>>,
>(
  declaration: ListDeclaration<SortField, Node, Filters>,
): ListDeclaration<SortField, Node, Filters> {
  const { name } = declaration;
  for (const field of [
    ...Object.keys(declaration.sortFields),
    ...Object.keys(declaration.filters ?? {}),
  ]) {
    if (!camelCase.test(field)) {
      throw new Error(`List ${name}: field ${field} is not camelCase, such as updatedAt`);
    }
  }
  if (declaration.defaultOrderBy.length === 0) {
    throw new Error(`List ${name} needs a defaultOrderBy`);
  }
  return declaration;
}

/** The fields of a list call's input (ADR 0073). */
type ListShape<SortField extends string, Filters extends Readonly<Record<string, z.ZodType>>> = {
  readonly first: z.ZodOptional<z.ZodType<number>>;
  readonly after: z.ZodOptional<z.ZodType<string>>;
  readonly orderBy: z.ZodOptional<z.ZodType<ListOrder<SortField>[]>>;
  readonly search: z.ZodOptional<z.ZodType<string>>;
  readonly includeArchived: z.ZodOptional<z.ZodType<boolean>>;
} & { readonly [Field in keyof Filters]: z.ZodOptional<Filters[Field]> };

/** What a list call answers: the nodes of one page and how to read the next one. */
const pageInfo = z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() });

type ListOutput<Node extends ObjectSchema> = z.ZodObject<{
  nodes: z.ZodArray<Node>;
  pageInfo: typeof pageInfo;
}>;

export interface ListQueryContractOptions<List extends ListDeclaration> {
  /** `<module>.<query>`, such as core.findArticles. */
  readonly name: string;
  readonly list: List;
  readonly permission: string;
}

type SortFieldOf<List> = List extends ListDeclaration<infer SortField> ? SortField : never;
type NodeOf<List> = List extends ListDeclaration<string, infer Node> ? Node : never;
type FiltersOf<List> =
  List extends ListDeclaration<string, ObjectSchema, infer Filters> ? Filters : never;

/** A list's query contract, which defineListQueryContract derives from its declaration. */
export type ListQueryContract<List extends ListDeclaration = ListDeclaration> = QueryContract<{
  readonly name: string;
  readonly input: z.ZodObject<ListShape<SortFieldOf<List>, FiltersOf<List>>>;
  readonly output: ListOutput<NodeOf<List>>;
  readonly permission: string;
}> & { readonly list: List };

/**
 * Derives a list's query contract from its declaration, with the same rules on every surface
 * (ADR 0073): first (1 to 100) and after with the list kit's cursors; orderBy as up to three
 * declared sort fields, each optionally prefixed with - for descending; one optional field per
 * declared filter; search over the declared search fields; and includeArchived for an archivable
 * list. The output is `{ nodes, pageInfo: { hasNextPage, endCursor } }`, the connection without
 * edges.
 */
export function defineListQueryContract<const List extends ListDeclaration>({
  name,
  list,
  permission,
}: ListQueryContractOptions<List>): ListQueryContract<List> {
  checkOperationName('Query', name);
  const fields = Object.keys(list.sortFields);
  const orders = [...fields, ...fields.map((field) => `-${field}`)] as [string, ...string[]];
  const filters = Object.fromEntries(
    Object.entries(list.filters ?? {}).map(([field, schema]) => [field, schema.optional()]),
  );
  const input = z.object({
    first: z.int().min(1).max(LIST_MAX_PAGE_SIZE).optional(),
    after: z.string().optional(),
    orderBy: z.array(z.enum(orders)).max(MAX_ORDER_BY_ENTRIES).optional(),
    ...filters,
    search: z.string().max(MAX_SEARCH_LENGTH).optional(),
    ...(list.archivable ? { includeArchived: z.boolean().optional() } : {}),
  });
  const output = z.object({ nodes: z.array(list.node), pageInfo });
  return {
    kind: 'query',
    name,
    list,
    permission,
    input: input as unknown as ListQueryContract<List>['input'],
    output: output as ListQueryContract<List>['output'],
  };
}

/** Whether a query contract is a list's, which defineListQueryContract derived. */
export function isListQueryContract(contract: object): contract is ListQueryContract {
  return 'kind' in contract && contract.kind === 'query' && 'list' in contract;
}
