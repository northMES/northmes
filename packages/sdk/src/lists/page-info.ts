// SPDX-License-Identifier: MIT
import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';

/** The direction of one orderBy entry of a list (ADR 0016). */
export const SortDirection = { ASC: 'ASC', DESC: 'DESC' } as const;
export type SortDirection = (typeof SortDirection)[keyof typeof SortDirection];

registerEnumType(SortDirection, { name: 'SortDirection' });

/**
 * Where a page of a connection sits in its list, per the Relay specification (ADR 0016). Every
 * connection shares this one type, so it comes from the SDK and from no module (ADR 0070).
 */
@ObjectType('PageInfo')
export class PageInfo {
  /** Exact when paging forward; when paging backward, whether the page came from a before cursor. */
  @Field(() => Boolean) hasNextPage!: boolean;
  /** Exact when paging backward; when paging forward, whether the page came from an after cursor. */
  @Field(() => Boolean) hasPreviousPage!: boolean;
  /** The cursor of the page's first edge, or null when the page is empty. */
  @Field(() => String, { nullable: true }) startCursor!: string | null;
  /** The cursor of the page's last edge, or null when the page is empty. */
  @Field(() => String, { nullable: true }) endCursor!: string | null;
}
