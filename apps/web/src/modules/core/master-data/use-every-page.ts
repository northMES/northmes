// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// shared-candidate: #66
import type { OperationVariables, TypedDocumentNode } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { useCallback, useEffect, useRef, useState } from 'react';

/** One page of a register's list, as a connection field answers it (ADR 0073). */
interface Page {
  readonly edges: readonly unknown[];
  readonly pageInfo: { readonly hasNextPage: boolean; readonly endCursor?: string | null };
}

/**
 * Every page of a register's list (ADR 0022): `query` reads one page of the connection `field`
 * after the cursor in its `after` variable. The hook reads the first page, then each next page
 * until the last, and adds its edges to the answer, so a list or a picker holds every row of a
 * short register. A next page that fails to load is `pageError` until `retryPage` loads it, or the
 * variables change; the rows already loaded stay.
 */
export function useEveryPage<
  Field extends string,
  Data extends { readonly [key in Field]: Page },
  Variables extends OperationVariables,
>(
  query: TypedDocumentNode<Data, Variables>,
  field: Field,
  variables: Variables,
  fetchPolicy?: 'cache-first' | 'cache-and-network',
) {
  // A generic Variables leaves useQuery's overloads unresolved, so the hook reads the query as
  // one whose variables are any record; the caller's types still check the variables it passes.
  const result = useQuery(query as TypedDocumentNode<Data, OperationVariables>, {
    variables,
    fetchPolicy,
  });
  const { data, fetchMore } = result;
  // A failed page, with the variables of the list it belongs to, so a new list does not show the
  // old error.
  const key = JSON.stringify(variables);
  const [failed, setFailed] = useState<{ key: string; error: unknown }>();
  const pageError = failed?.key === key ? failed.error : undefined;
  const pageInfo = data?.[field].pageInfo;
  const next = pageInfo?.hasNextPage ? pageInfo.endCursor : null;
  const loadPage = useCallback(
    (after: string) =>
      fetchMore({
        variables: { after },
        updateQuery: (previous, { fetchMoreResult }) =>
          ({
            ...fetchMoreResult,
            [field]: {
              ...fetchMoreResult[field],
              edges: [...(previous as Data)[field].edges, ...fetchMoreResult[field].edges],
            },
          }) as Data,
      }).then(
        () => setFailed(undefined),
        (error: unknown) =>
          setFailed({ key, error: error ?? new Error('The next page did not load') }),
      ),
    [fetchMore, field, key],
  );
  // The cursor already asked for, so a second run of the effect, as StrictMode does in
  // development, does not append the same page twice.
  const asked = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!next || asked.current === `${key} ${next}`) return;
    asked.current = `${key} ${next}`;
    void loadPage(next);
  }, [key, next, loadPage]);
  const retryPage = useCallback(
    () => (next ? loadPage(next) : Promise.resolve()),
    [next, loadPage],
  );
  return { ...result, pageError, retryPage };
}
