// SPDX-License-Identifier: MIT
import type { Type } from '@nestjs/common';
import {
  ArgsType,
  Field,
  InputType,
  Int,
  ObjectType,
  Parent,
  ResolveField,
  Resolver,
  registerEnumType,
} from '@nestjs/graphql';
import { type SelectQueryBuilder, type SqlBool, sql, type Transaction } from 'kysely';
import type { ScopedDatabase } from '../data/database.ts';
import { DomainError } from '../errors/domain-error.ts';
import { decodeCursor, encodeCursor } from './cursor.ts';
import { PageInfo, SortDirection } from './page-info.ts';

/** A column a list sorts by: its name in the list's query and its Postgres type. */
export interface SortColumn {
  readonly column: string;
  /** The type a cursor's text value is cast back to, such as text. */
  readonly type: string;
}

/** One entry of a list's orderBy argument. */
export interface OrderBy<SortField extends string> {
  readonly field: SortField;
  readonly direction?: SortDirection | null;
}

/** What a list declares once, and the kit builds its GraphQL types and its SQL from. */
export interface ListDeclaration<SortField extends string> {
  /**
   * The GraphQL name of the node type, such as Article. The kit names the list's types after it:
   * ArticleConnection, ArticleEdge, ArticleSortField and ArticleOrderBy.
   */
  readonly name: string;
  /** The node's GraphQL type. */
  readonly node: () => Type;
  /**
   * The columns behind each value of the SortField enum. Each is NOT NULL, because the kit does
   * not split a nullable key into its null and non-null rows yet (ADR 0016).
   */
  readonly sortFields: Readonly<Record<SortField, SortColumn>>;
  /** The order of a call without orderBy. */
  readonly defaultOrderBy: readonly OrderBy<NoInfer<SortField>>[];
}

/** The arguments of a list's root field (ADR 0016). */
export interface ListArgs<SortField extends string> {
  readonly first?: number | null;
  readonly after?: string | null;
  readonly last?: number | null;
  readonly before?: string | null;
  readonly orderBy?: readonly OrderBy<SortField>[] | null;
  readonly search?: string | null;
}

export interface Edge<Node> {
  readonly cursor: string;
  readonly node: Node;
}

/** What a list's root field resolves to. */
export interface Connection<Node> {
  readonly edges: readonly Edge<Node>[];
  readonly pageInfo: PageInfo;
  /**
   * Counts the rows of the list without paging. The list's ConnectionResolver calls it for
   * totalCount, so the count runs only when a query selects that field (ADR 0016).
   */
  count(): Promise<number>;
}

/** The page size of a call without first or last. */
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

/** A sort key of a page's order: a column with its type and direction. */
interface Key extends SortColumn {
  readonly direction: SortDirection;
}

/** A class with this name, so Nest's messages and the schema name it. */
function namedClass(name: string): Type {
  return { [name]: class {} }[name] as Type;
}

function badArgument(message: string): DomainError {
  return new DomainError({ code: 'core.list.bad_argument', kind: 'validation', message });
}

/** The page size the arguments ask for. */
function pageSize(args: ListArgs<string>): number {
  const size = args.first ?? DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(size) || size < 1 || size > MAX_PAGE_SIZE) {
    throw badArgument(`first must be between 1 and ${MAX_PAGE_SIZE}`);
  }
  return size;
}

/**
 * The keys of the order the arguments ask for, with id last as the tie-breaker in the direction of
 * the last entry (ADR 0016).
 */
function keysOf<SortField extends string>(
  declaration: ListDeclaration<SortField>,
  args: ListArgs<SortField>,
): Key[] {
  const orderBy = args.orderBy?.length ? args.orderBy : declaration.defaultOrderBy;
  const keys = orderBy.map(({ field, direction }) => ({
    ...declaration.sortFields[field],
    direction: direction ?? SortDirection.ASC,
  }));
  const last = keys.at(-1)?.direction ?? SortDirection.ASC;
  return [...keys, { column: 'id', type: 'uuid', direction: last }];
}

/** The order signature a cursor carries, such as code.AL,id.AL: column, direction, nulls last. */
function signatureOf(keys: readonly Key[]): string {
  return keys.map(({ column, direction }) => `${column}.${direction.charAt(0)}L`).join(',');
}

/**
 * The rows after the cursor's values in the order of `keys`: those beyond it on the first key, or
 * equal on the first key and beyond it on the second, and so on.
 */
function afterValues(keys: readonly Key[], values: readonly string[]) {
  const value = (index: number) => {
    const key = keys[index] as Key;
    return sql`cast(${values[index]} as ${sql.raw(key.type)})`;
  };
  const branches = keys.map((key, index) => {
    const equal = keys
      .slice(0, index)
      .map(({ column }, before) => sql`${sql.ref(column)} = ${value(before)}`);
    const beyond = sql`${sql.ref(key.column)} ${sql.raw(key.direction === 'ASC' ? '>' : '<')} ${value(index)}`;
    return sql`(${sql.join([...equal, beyond], sql` and `)})`;
  });
  return sql<SqlBool>`(${sql.join(branches, sql` or `)})`;
}

/**
 * Declares a list: its GraphQL types and the SQL of its pages, with keyset paging over opaque
 * cursors (ADR 0016). This is the smallest kit the first list needs: orderBy over declared sort
 * fields, paging forward and backward, search and a totalCount that runs only when selected. Filter,
 * group by and aggregates come with the full kit.
 */
export function defineList<const SortField extends string>(
  declaration: ListDeclaration<SortField>,
) {
  const { name, node, sortFields } = declaration;

  const SortFieldEnum = Object.fromEntries(Object.keys(sortFields).map((field) => [field, field]));
  registerEnumType(SortFieldEnum, { name: `${name}SortField` });

  const OrderByInput = namedClass(`${name}OrderBy`);
  Field(() => SortFieldEnum)(OrderByInput.prototype, 'field');
  Field(() => SortDirection, { nullable: true, defaultValue: SortDirection.ASC })(
    OrderByInput.prototype,
    'direction',
  );
  InputType(`${name}OrderBy`)(OrderByInput);

  const EdgeType = namedClass(`${name}Edge`);
  Field(() => String)(EdgeType.prototype, 'cursor');
  Field(node)(EdgeType.prototype, 'node');
  ObjectType(`${name}Edge`)(EdgeType);

  const ConnectionType = namedClass(`${name}Connection`);
  Field(() => [EdgeType])(ConnectionType.prototype, 'edges');
  Field(() => PageInfo)(ConnectionType.prototype, 'pageInfo');
  Field(() => Int)(ConnectionType.prototype, 'totalCount');
  ObjectType(`${name}Connection`)(ConnectionType);

  const ArgsClass = namedClass(`${name}ListArgs`);
  const optional = { nullable: true } as const;
  Field(() => Int, { nullable: true, defaultValue: DEFAULT_PAGE_SIZE })(
    ArgsClass.prototype,
    'first',
  );
  Field(() => String, optional)(ArgsClass.prototype, 'after');
  Field(() => Int, optional)(ArgsClass.prototype, 'last');
  Field(() => String, optional)(ArgsClass.prototype, 'before');
  Field(() => [OrderByInput], optional)(ArgsClass.prototype, 'orderBy');
  Field(() => String, optional)(ArgsClass.prototype, 'search');
  ArgsType()(ArgsClass);

  @Resolver(() => ConnectionType)
  class ConnectionResolver {
    /** The rows of the list without paging, counted only when a query selects this field. */
    @ResolveField(() => Int)
    totalCount(@Parent() connection: Connection<unknown>): Promise<number> {
      return connection.count();
    }
  }
  // Nest's messages name the class, so it carries the connection's name.
  Object.defineProperty(ConnectionResolver, 'name', { value: `${name}ConnectionResolver` });

  return {
    /** The <Name>Connection object type, which the list's root field returns. */
    Connection: ConnectionType,
    /** The arguments of the root field, for @Args({ type: () => list.Args }). */
    Args: ArgsClass,
    /**
     * The resolver of the connection's totalCount field, which the module lists among the
     * providers of its Nest module next to the resolver of the list's root field.
     */
    ConnectionResolver: ConnectionResolver as Type,
    /**
     * Reads one page of the rows that `query` selects, in one ScopedDatabase transaction, as the
     * root field's arguments ask. `query` selects the node's columns, id among them, from the
     * list's table. A refused argument is BAD_USER_INPUT with core.list.bad_argument, and a cursor
     * of another order is core.list.invalid_cursor (ADR 0016).
     */
    async page<DB, TB extends keyof DB, Row extends { readonly id: string }>(
      db: ScopedDatabase<DB>,
      query: (tx: Transaction<DB>) => SelectQueryBuilder<DB, TB, Row>,
      args: ListArgs<SortField>,
    ): Promise<Connection<Row>> {
      const size = pageSize(args);
      const keys = keysOf(declaration, args);
      const signature = signatureOf(keys);
      const after = args.after ? decodeCursor(args.after, signature, keys.length) : undefined;
      const aliases = keys.map((_key, index) => `_nm_key_${index}`);

      const rows = await db.transaction((tx) => {
        let rowsQuery = query(tx);
        if (after) rowsQuery = rowsQuery.where(afterValues(keys, after));
        let ordered = rowsQuery.select(
          keys.map(({ column }, index) =>
            sql<string>`${sql.ref(column)}::text`.as(aliases[index] as string),
          ),
        );
        for (const { column, direction } of keys) {
          ordered = ordered.orderBy(sql.ref(column), direction === 'ASC' ? 'asc' : 'desc');
        }
        return ordered.limit(size + 1).execute();
      });

      const edges = rows.slice(0, size).map((row) => {
        const record = row as Record<string, unknown>;
        const values = aliases.map((alias) => String(record[alias]));
        const nodeValue = Object.fromEntries(
          Object.entries(record).filter(([column]) => !aliases.includes(column)),
        ) as Row;
        return { cursor: encodeCursor(signature, values), node: nodeValue };
      });
      return {
        edges,
        pageInfo: {
          hasNextPage: rows.length > size,
          hasPreviousPage: after !== undefined,
          startCursor: edges[0]?.cursor ?? null,
          endCursor: edges.at(-1)?.cursor ?? null,
        },
        count: () =>
          db.transaction(async (tx) => {
            const { rows } = await sql<{ count: string }>`select count(*) as count from (${query(
              tx,
            )}) as list`.execute(tx);
            return Number(rows[0]?.count);
          }),
      };
    },
  };
}
