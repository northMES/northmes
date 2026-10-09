// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from '@apollo/client/react';
import { coreLinks } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { Building2, Factory, Plus } from 'lucide-react';
import { useMemo } from 'react';
import { DataTable, type DataTableColumn } from '../../../../ui/components/data-table/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { SearchField } from '../../../../ui/components/search-field/index.ts';
import { isForbidden } from '../../../../ui/lib/graphql-errors.ts';
import { Badge } from '../../../../ui/primitives/badge.tsx';
import { Button, buttonVariants } from '../../../../ui/primitives/button.tsx';
import { noAccessState } from '../../no-access.tsx';
import { usePlaces } from '../../use-places.ts';
import { useViewer } from '../../use-viewer.ts';
import {
  nextUsersPage,
  previousUsersPage,
  type UserListSearch,
  userListSearch,
  userListVariables,
  userPageSize,
  usersSearchedFor,
} from '../../user-list-search.ts';
import { UserStatus } from '../../user-status.tsx';
import { CoreUsers, type CoreUsersQuery } from './users.graphql.ts';

/** One user of the list. */
type UserRow = CoreUsersQuery['coreUsers']['edges'][number]['node'];

/** The id of Search users, where Clear search moves focus. */
const searchFieldId = 'users-search';

/** The user's name, the link to the user's page. */
function UserLink({ user }: { readonly user: UserRow }) {
  const { plant } = useShell();
  return (
    <Link
      to={coreLinks.users.user({ plant, userId: user.id }).href}
      className="text-link underline underline-offset-2 hover:no-underline"
    >
      {user.name}
    </Link>
  );
}

/**
 * The user's roles per place as chips (design core-304, US1): "Shift lead at Plant A" with the
 * place's icon, or No access for a role the reader may not read.
 */
function RoleChips({ user }: { readonly user: UserRow }) {
  if (user.roleAssignments.length === 0) {
    return <span className="text-muted-foreground">No role</span>;
  }
  return (
    <ul className="flex flex-wrap gap-1">
      {user.roleAssignments.map(({ id, role, scope }) => {
        const Place = scope.kind === 'COMPANY' ? Building2 : Factory;
        return (
          <li key={id}>
            <Badge variant="outline" className="font-normal">
              <Place aria-hidden />
              {role?.name ?? 'No access'} at {scope.name}
            </Badge>
          </li>
        );
      })}
    </ul>
  );
}

/** The columns of the list; the roles column names the two places it reads. */
function columnsOf(companyName: string, plantName: string): readonly DataTableColumn<UserRow>[] {
  return [
    { id: 'name', header: 'Name', cell: (user) => <UserLink user={user} /> },
    {
      id: 'username',
      header: 'Username',
      cell: (user) => <span className="font-mono">{user.username}</span>,
    },
    {
      id: 'roles',
      header: `Roles at ${companyName} and ${plantName}`,
      cell: (user) => <RoleChips user={user} />,
    },
    { id: 'status', header: 'Status', cell: (user) => <UserStatus blocked={user.blocked} /> },
  ];
}

/**
 * The users of the company (design core-304, US1): Search users, and one page of 25 users by name
 * with their username, their roles at the company and at the plant as chips, and their status,
 * with Previous and Next. Search and page live in the URL. New user shows to a user who may
 * create users. The list takes the canonical list's loading, empty and error states with users as
 * the noun; a reader without core.user:read gets the page "No access to Users".
 */
export function UsersScreen() {
  const { plant } = useShell();
  const places = usePlaces();
  const viewer = useViewer();
  const view = userListSearch(useSearch({ strict: false }));
  const navigate = useNavigate();
  const { data, previousData, error, refetch } = useQuery(CoreUsers, {
    variables: userListVariables(view),
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all',
  });
  const page = data?.coreUsers;
  const shownPage = page ?? previousData?.coreUsers;
  const companyName = places.company?.name ?? 'the company';
  const plantName = places.plant?.name ?? plant;
  const columns = useMemo(() => columnsOf(companyName, plantName), [companyName, plantName]);
  const show = (next: UserListSearch) => {
    navigate({ to: '.', search: next, replace: true });
  };
  const forbidden = page === undefined && isForbidden(error);
  // The API checks core.user:create at the company (its scope hook), so a plant role's is not enough.
  const newUser = viewer.canAtCompany('core.user:create') ? (
    <Link to={coreLinks.users.new({ plant }).href} className={buttonVariants()}>
      <Plus aria-hidden />
      New user
    </Link>
  ) : undefined;
  let state: PageState = { status: 'ready' };
  if (forbidden) {
    state = noAccessState('Users', 'core.user:read', plantName);
  } else if (page === undefined && error !== undefined) {
    state = {
      status: 'error',
      title: 'Could not load users',
      description: 'Check the connection, then try again.',
      onRetry: () => {
        refetch().catch(() => {});
      },
    };
  } else if (page === undefined) {
    state = { status: 'loading' };
  } else if (page.totalCount === 0 && view.q !== undefined) {
    state = {
      status: 'empty',
      title: 'No users match this search',
      description: 'Change or clear the search to see users again.',
      action: (
        <Button
          variant="link"
          onClick={() => {
            show({});
            document.getElementById(searchFieldId)?.focus();
          }}
        >
          Clear search
        </Button>
      ),
    };
  } else if (page.totalCount === 0) {
    state = {
      status: 'empty',
      title: 'No users yet',
      description: `Users of ${companyName} show here once they are created.`,
      action: newUser,
    };
  }
  return (
    <PageFrame
      title={forbidden ? 'No access to Users' : 'Users'}
      actions={newUser}
      toolbar={
        forbidden ? undefined : (
          <SearchField
            id={searchFieldId}
            label="Search users"
            value={view.q ?? ''}
            onSearch={(text) => show(usersSearchedFor(text))}
            className="w-full max-w-sm"
          />
        )
      }
      state={state}
    >
      <DataTable
        label="Users"
        columns={columns}
        rows={page?.edges.map(({ node }) => node) ?? []}
        getRowId={(user) => user.id}
        loading={page === undefined}
        paging={{
          page: view.page ?? 1,
          pageSize: userPageSize,
          totalCount: page?.totalCount,
          hasPreviousPage: view.page !== undefined && (page?.pageInfo.hasPreviousPage ?? true),
          hasNextPage: shownPage?.pageInfo.hasNextPage ?? false,
          onPrevious: () => {
            const startCursor = page?.pageInfo.startCursor;
            if (startCursor) show(previousUsersPage(view, startCursor));
          },
          onNext: () => {
            const endCursor = page?.pageInfo.endCursor;
            if (endCursor) show(nextUsersPage(view, endCursor));
          },
        }}
      />
    </PageFrame>
  );
}
