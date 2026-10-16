// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link } from '@tanstack/react-router';
import { Archive, Plus } from 'lucide-react';
import { useState } from 'react';
import { DataTable, type DataTableColumn } from '../../../../ui/components/data-table/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { StatusBadge } from '../../../../ui/components/status-badge/index.ts';
import { formatDateTime } from '../../../../ui/lib/date-time.ts';
import { isForbidden } from '../../../../ui/lib/graphql-errors.ts';
import { buttonVariants } from '../../../../ui/primitives/button.tsx';
import { Checkbox } from '../../../../ui/primitives/checkbox.tsx';
import { Field, FieldLabel } from '../../../../ui/primitives/field.tsx';
import type { ArticleGroupRow } from '../../article-groups.graphql.ts';
import { readForbiddenState } from '../../no-access.tsx';
import { useArticleGroups } from '../../use-article-groups.ts';
import { usePlaces } from '../../use-places.ts';
import { useViewer } from '../../use-viewer.ts';

/** The id of the Show archived checkbox, which its label names. */
const showArchivedId = 'article-groups-show-archived';

/** The group's code, the link to its page. */
function GroupLink({ group }: { readonly group: ArticleGroupRow }) {
  const { plant } = useShell();
  return (
    <Link
      to={coreLinks.articleGroups.articleGroup({ plant, articleGroupId: group.id }).href}
      className="font-mono text-link underline underline-offset-2 hover:no-underline"
    >
      {group.code}
    </Link>
  );
}

const columns: readonly DataTableColumn<ArticleGroupRow>[] = [
  { id: 'code', header: 'Code', cell: (group) => <GroupLink group={group} /> },
  {
    id: 'name',
    header: 'Name',
    cell: (group) =>
      group.archivedAt === null ? (
        group.name
      ) : (
        <span className="flex flex-wrap items-center gap-2">
          {group.name}
          <StatusBadge tone="neutral" icon={Archive}>
            Archived
          </StatusBadge>
        </span>
      ),
  },
  {
    id: 'changed',
    header: 'Last changed',
    cell: (group) => (
      <time dateTime={group.updatedAt} className="font-mono">
        {formatDateTime(group.updatedAt)}
      </time>
    ),
  },
];

/** New article group, for a holder of core.articleGroup:create at the company. */
function NewArticleGroupLink() {
  const { plant } = useShell();
  const viewer = useViewer();
  if (!viewer.canAtCompany('core.articleGroup:create')) return null;
  return (
    <Link to={coreLinks.articleGroups.new({ plant }).href} className={buttonVariants()}>
      <Plus aria-hidden />
      New article group
    </Link>
  );
}

/**
 * The company's article groups under Master data (maintainer, 2026-10-09): one table of Code,
 * Name and Last changed by code, with Show archived; each code opens the group's page. A company
 * keeps a short list, so the table shows every group on one page. New article group shows to a
 * holder of core.articleGroup:create at the company, since the groups are the company's.
 */
export function ArticleGroupsScreen() {
  const [showArchived, setShowArchived] = useState(false);
  const { data, previousData, error, refetch, pageError, retryPage } = useArticleGroups(
    showArchived,
    'cache-and-network',
  );
  const page = data?.coreArticleGroups ?? previousData?.coreArticleGroups;
  const forbidden = data === undefined && isForbidden(error);
  const places = usePlaces({ skip: !forbidden });
  let state: PageState = { status: 'ready' };
  if (forbidden) {
    state = readForbiddenState('article groups', places.company?.name ?? 'the company');
  } else if (page === undefined && error !== undefined) {
    state = {
      status: 'error',
      title: 'Could not load article groups',
      error,
      onRetry: () => refetch(),
    };
  } else if (pageError !== undefined) {
    state = {
      status: 'error',
      title: 'Could not load article groups',
      error: pageError,
      onRetry: retryPage,
    };
  } else if (page !== undefined && page.totalCount === 0 && !showArchived) {
    state = {
      status: 'empty',
      title: 'No article groups yet',
      description: 'Groups sort articles, such as Flanges or Consumables. Create the first one.',
      action: <NewArticleGroupLink />,
    };
  }
  return (
    <PageFrame
      title="Article groups"
      actions={forbidden ? undefined : <NewArticleGroupLink />}
      toolbar={
        forbidden ? undefined : (
          <Field orientation="horizontal" className="w-auto">
            <Checkbox
              id={showArchivedId}
              checked={showArchived}
              onCheckedChange={(shown) => setShowArchived(shown)}
            />
            <FieldLabel htmlFor={showArchivedId}>Show archived</FieldLabel>
          </Field>
        )
      }
      state={state}
      busy={data === undefined && page !== undefined}
    >
      <DataTable
        label="Article groups"
        columns={columns}
        rows={page?.edges.map(({ node }) => node) ?? []}
        getRowId={(group) => group.id}
        loading={page === undefined}
      />
    </PageFrame>
  );
}
