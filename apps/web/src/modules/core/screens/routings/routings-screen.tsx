// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link, useSearch } from '@tanstack/react-router';
import { Lock, Route } from 'lucide-react';
import { useMemo } from 'react';
import { DataTable, type DataTableColumn } from '../../../../ui/components/data-table/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { routingPageSearch } from '../../routing-search.ts';
import { type Routing, RoutingsForbidden } from '../../routings-data.ts';
import { useRoutings } from '../../routings-source-context.ts';

const link = 'text-link underline underline-offset-2 hover:no-underline';

function columnsOf(plant: string): DataTableColumn<Routing>[] {
  return [
    {
      id: 'article',
      header: 'Article',
      cell: (routing) => (
        <span className="flex flex-col">
          <Link
            to={coreLinks.routings.routing({ plant, articleId: routing.articleNumber }).href}
            className={`font-mono ${link}`}
          >
            {routing.articleNumber}
          </Link>
          <span className="text-xs text-muted-foreground">{routing.articleName}</span>
        </span>
      ),
    },
    {
      id: 'operations',
      header: 'Operations',
      numeric: true,
      cell: (routing) => <span className="font-mono">{routing.operations.length}</span>,
    },
    {
      id: 'version',
      header: 'ERP routing version',
      numeric: true,
      cell: (routing) => <span className="font-mono">{routing.erpVersion}</span>,
    },
    {
      id: 'kept',
      header: 'Kept in NorthMES',
      cell: (routing) => {
        const kept = routing.operations.filter((operation) => operation.kept !== undefined).length;
        return kept === 0 ? (
          <span className="text-xs text-muted-foreground">None</span>
        ) : (
          `${kept} kept in NorthMES`
        );
      },
    },
  ];
}

/**
 * The routings of the plant under Master data (plan 07; design #729): one row per article with its
 * active routing, the number of operations, the ERP's routing version and how many operations a
 * planner keeps in NorthMES, each leading to the routing's page. The preview key opens the loading,
 * empty, failed and no-access states on the fixture.
 */
export function RoutingsScreen() {
  const { plant } = useShell();
  const search = routingPageSearch(useSearch({ strict: false }));
  const { snapshot, error, retry } = useRoutings(search.preview);
  const rows = useMemo(
    () =>
      [...(snapshot?.routings ?? [])].sort((a, b) =>
        a.articleNumber < b.articleNumber ? -1 : a.articleNumber > b.articleNumber ? 1 : 0,
      ),
    [snapshot],
  );
  const columns = useMemo(() => columnsOf(plant), [plant]);
  let state: PageState = { status: 'ready' };
  if (snapshot === undefined && error instanceof RoutingsForbidden) {
    state = {
      status: 'empty',
      icon: Lock,
      title: 'You need the permission to read routings at this plant',
      description: 'Ask your plant admin for a role that can read routings.',
    };
  } else if (snapshot === undefined && error !== undefined) {
    state = { status: 'error', title: 'Could not load routings', error, onRetry: retry };
  } else if (snapshot === undefined) {
    state = { status: 'loading' };
  } else if (rows.length === 0) {
    state = {
      status: 'empty',
      icon: Route,
      title: 'No routings yet',
      description: 'Routings come from the ERP with the articles’ operations.',
    };
  }
  return (
    <PageFrame
      title="Routings"
      toolbar={
        <p className="text-xs text-muted-foreground" data-list-status>
          {snapshot === undefined
            ? 'Loading routings.'
            : `${rows.length} routing${rows.length === 1 ? '' : 's'}, one active routing per article. Sorted by article.${
                snapshot.fixture === undefined ? '' : ` Showing fixture ${snapshot.fixture}.`
              }`}
        </p>
      }
      state={state}
    >
      <DataTable
        label="Routings"
        columns={columns}
        rows={rows}
        getRowId={(routing) => routing.articleNumber}
        loading={snapshot === undefined}
      />
    </PageFrame>
  );
}
