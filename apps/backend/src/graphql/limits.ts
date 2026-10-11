// SPDX-License-Identifier: AGPL-3.0-or-later

/** The limits every GraphQL request must stay within (plan 05, audit finding B4). */
export interface GraphqlLimits {
  /** The largest request body in bytes, for every content type. */
  readonly maxBodyBytes: number;
  /** The deepest field nesting of an operation. */
  readonly maxDepth: number;
  /** The most aliases in one document. */
  readonly maxAliases: number;
  /** The most lexical tokens in one document. */
  readonly maxTokens: number;
  /** The highest cost of one operation. */
  readonly maxCost: number;
  /** The size a list costs when neither its first or last nor the schema gives one. */
  readonly defaultListSize: number;
}

/**
 * The numbers of plan 05: a depth of 12 allows three nested connection levels and a related object,
 * and a cost of 20 000 allows a table of 100 rows with a few related objects but not 100 rows with
 * 100 nested rows each. Express's JSON limit is 100 kB, so the cap for every other type is the same.
 */
export const graphqlLimits: GraphqlLimits = {
  maxBodyBytes: 100_000,
  maxDepth: 12,
  maxAliases: 15,
  maxTokens: 2000,
  maxCost: 20_000,
  defaultListSize: 25,
};
