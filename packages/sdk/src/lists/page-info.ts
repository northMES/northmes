// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';

/** The direction of one orderBy entry of a list (ADR 0016). */
export const SortDirection = { ASC: 'ASC', DESC: 'DESC' } as const;
export type SortDirection = (typeof SortDirection)[keyof typeof SortDirection];

registerEnumType(SortDirection, {
  name: 'SortDirection',
  description: 'The direction of one orderBy entry of a list.',
  valuesMap: {
    ASC: { description: 'Ascending: A to Z, oldest first, smallest first.' },
    DESC: { description: 'Descending: Z to A, newest first, largest first.' },
  },
});

/**
 * Where a page of a connection sits in its list, per the Relay specification (ADR 0016). Every
 * connection shares this one type, so it comes from the SDK and from no module (ADR 0070).
 */
@ObjectType('PageInfo', {
  description: 'Where a page of a connection sits in its list, per the Relay specification.',
})
export class PageInfo {
  @Field(() => Boolean, {
    description:
      'Whether a page follows this one. Exact when paging forward; when paging backward, whether the page came from a before cursor.',
  })
  hasNextPage!: boolean;
  @Field(() => Boolean, {
    description:
      'Whether a page comes before this one. Exact when paging backward; when paging forward, whether the page came from an after cursor.',
  })
  hasPreviousPage!: boolean;
  @Field(() => String, {
    nullable: true,
    description: "The cursor of the page's first edge, or null when the page is empty.",
  })
  startCursor!: string | null;
  @Field(() => String, {
    nullable: true,
    description: "The cursor of the page's last edge, or null when the page is empty.",
  })
  endCursor!: string | null;
}
