// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from '@apollo/client/react';
import { coreLinks } from '@northmes/core-contracts';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import {
  Ban,
  Building2,
  ChevronDown,
  CircleCheck,
  Ellipsis,
  Factory,
  KeyRound,
  Plus,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { DataTable, type DataTableColumn } from '../../../../ui/components/data-table/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { SearchField } from '../../../../ui/components/search-field/index.ts';
import { isForbidden } from '../../../../ui/lib/graphql-errors.ts';
import { shownListPage } from '../../../../ui/lib/shown-list-page.ts';
import { Badge } from '../../../../ui/primitives/badge.tsx';
import { Button, buttonVariants } from '../../../../ui/primitives/button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../../../../ui/primitives/dropdown-menu.tsx';
import { noAccessState } from '../../no-access.tsx';
import { CoreRoles } from '../../roles.graphql.ts';
import { useCompanyId, usePlaces } from '../../use-places.ts';
import { useViewer } from '../../use-viewer.ts';
import {
  nextUsersPage,
  previousUsersPage,
  type UserListSearch,
  type UserStatusFilter,
  userListSearch,
  userListVariables,
  userPageSize,
  userSortOf,
  usersSearchedFor,
  usersSortedBy,
  usersUnfiltered,
  usersWithRole,
  usersWithStatus,
} from '../../user-list-search.ts';
import { UserStatus } from '../../user-status.tsx';
import { BlockUserDialog, ResetPasswordDialog } from '../user/user-actions.tsx';
import { CoreUsers, type CoreUsersQuery } from './users.graphql.ts';

/** One user of the list. */
type UserRow = CoreUsersQuery['coreUsers']['edges'][number]['node'];

/** The id of Search users, where Clear search moves focus. */
const searchFieldId = 'users-search';

/** The user's name, the link to the user's page. */
function UserLink({ user }: { readonly user: UserRow }) {
  const companyId = useCompanyId() ?? '';
  return (
    <Link
      to={coreLinks.settings.users.user({ companyId, userId: user.id }).href}
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

/** What the reader may do to the users of the list, which decides their rows' menus. */
interface RowRights {
  /** The reader's own user id, whose row has no menu. */
  readonly self: string | undefined;
  readonly canReset: boolean;
  readonly canBlock: boolean;
}

/** The dialog a row's menu item opens. */
type RowDialog = 'reset' | 'block';

/**
 * The row menu of a user (design core-304, US3 and US4): a button named "Actions for {name}" that
 * opens a menu with focus on its first item, Reset password for an active user and Block user, or
 * Unblock user for a blocked one, each shown by permission. Escape closes it and returns focus to
 * the button. An item opens the dialog of the user's page; after it, focus returns to the button.
 */
function UserRowMenu({ user, rights }: { readonly user: UserRow; readonly rights: RowRights }) {
  const [dialog, setDialog] = useState<RowDialog | undefined>(undefined);
  const first = useRef<HTMLDivElement>(null);
  const buttonId = `user-actions-${user.id}`;
  const items = [
    ...(rights.canReset && !user.blocked
      ? [{ id: 'reset' as const, label: 'Reset password', Icon: KeyRound }]
      : []),
    ...(rights.canBlock
      ? [
          user.blocked
            ? { id: 'block' as const, label: 'Unblock user', Icon: CircleCheck }
            : { id: 'block' as const, label: 'Block user', Icon: Ban },
        ]
      : []),
  ];
  if (user.id === rights.self || items.length === 0) return null;
  const label = `Actions for ${user.name}`;
  // The dialogs stay mounted while closed: the reset's keeps the temporary password it shows after
  // its confirm dialog closed.
  const dialogProps = (id: RowDialog) => ({
    user,
    open: dialog === id,
    onOpenChange: (open: boolean) => {
      if (!open) setDialog(undefined);
    },
    focusAfter: () => document.getElementById(buttonId),
  });
  return (
    <>
      <DropdownMenu
        onOpenChangeComplete={(open) => {
          if (open) first.current?.focus();
        }}
      >
        <DropdownMenuTrigger
          render={<Button id={buttonId} variant="ghost" size="icon" aria-label={label} />}
        >
          <Ellipsis aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-55" aria-label={label}>
          {items.map(({ id, label: text, Icon }, index) => (
            <DropdownMenuItem
              key={id}
              ref={index === 0 ? first : undefined}
              onClick={() => setDialog(id)}
            >
              <Icon aria-hidden />
              {text}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {items.some(({ id }) => id === 'reset') && <ResetPasswordDialog {...dialogProps('reset')} />}
      {items.some(({ id }) => id === 'block') && <BlockUserDialog {...dialogProps('block')} />}
    </>
  );
}

/**
 * The columns of the list, as C1 of design shell-313 and US1 of core-304 head them: Name and
 * Username sort, and a row's Actions menu shows when the reader may reset passwords or block users.
 */
function columnsOf(rights: RowRights): readonly DataTableColumn<UserRow>[] {
  return [
    { id: 'name', header: 'Name', sortable: true, cell: (user) => <UserLink user={user} /> },
    {
      id: 'username',
      header: 'Username',
      sortable: true,
      cell: (user) => <span className="font-mono">{user.username}</span>,
    },
    {
      id: 'roles',
      header: 'Roles',
      cell: (user) => <RoleChips user={user} />,
    },
    { id: 'status', header: 'Status', cell: (user) => <UserStatus blocked={user.blocked} /> },
    ...(rights.canReset || rights.canBlock
      ? [
          {
            id: 'actions',
            header: 'Actions',
            headerHidden: true,
            cell: (user: UserRow) => <UserRowMenu user={user} rights={rights} />,
          },
        ]
      : []),
  ];
}

/** One choice of a filter menu: its value, or undefined for every value, and its label. */
interface FilterChoice<TValue extends string> {
  readonly value: TValue | undefined;
  readonly label: string;
}

/** The value of "every value" in a filter menu's radio group. */
const anyValue = '';

/**
 * A filter of the toolbar (design core-304, US1): an outline button named by the filter, and by
 * its choice once one applies, such as "Role: Shift lead", that opens a menu of radio items.
 */
function FilterMenu<TValue extends string>({
  label,
  value,
  choices,
  onChange,
}: {
  readonly label: string;
  readonly value: TValue | undefined;
  readonly choices: readonly FilterChoice<TValue>[];
  readonly onChange: (value: TValue | undefined) => void;
}) {
  const chosen = choices.find((choice) => choice.value !== undefined && choice.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        {chosen === undefined ? label : `${label}: ${chosen.label}`}
        <ChevronDown aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48">
        <DropdownMenuRadioGroup
          value={value ?? anyValue}
          onValueChange={(next: string) =>
            onChange(next === anyValue ? undefined : (next as TValue))
          }
        >
          {choices.map((choice) => (
            <DropdownMenuRadioItem key={choice.value ?? anyValue} value={choice.value ?? anyValue}>
              {choice.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The choices of the Status filter. */
const statusChoices: readonly FilterChoice<UserStatusFilter>[] = [
  { value: undefined, label: 'Any status' },
  { value: 'active', label: 'Active' },
  { value: 'blocked', label: 'Blocked' },
];

/**
 * The users of the company in company settings (design core-304, US1 to US4, and shell-313, C1):
 * Search users, the Role and Status filters, and one page of 25 users, by Name unless Username
 * sorts it, with their username, their roles at the company and at each of its plants as chips,
 * their status and a row menu with Reset password and Block user or Unblock user by permission,
 * with Previous and Next. Search, filters, sort and page live in the URL. New user shows to a user
 * who may create users. The list takes the canonical list's loading, empty and error states with users as
 * the noun; a reader without core.user:read gets the page "No access to Users".
 */
export function UsersScreen() {
  const companyId = useCompanyId() ?? '';
  const places = usePlaces();
  const viewer = useViewer();
  const view = userListSearch(useSearch({ strict: false }));
  const navigate = useNavigate();
  const { data, previousData, error, refetch } = useQuery(CoreUsers, {
    variables: { companyId, ...userListVariables(view) },
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all',
  });
  // The Role filter lists the company's roles, for a reader who may read them.
  const canReadRoles = viewer.canAtCompany('core.role:read');
  const roles = useQuery(CoreRoles, { variables: { companyId }, skip: !canReadRoles });
  const filtered = view.role !== undefined || view.status !== undefined;
  const page = data?.coreUsers;
  // While a new search or page loads, the list keeps the users or the no-match state it shows, and
  // their pager, so focus stays on the control used (design ui-222, LI7).
  const shownPage = shownListPage({
    page,
    previous: previousData?.coreUsers,
    failed: error !== undefined,
    searching: view.q !== undefined || filtered,
  });
  const stale = page === undefined && shownPage !== undefined;
  const companyName = places.company?.name ?? 'the company';
  // The API checks both permissions at the company, and at every other company of the user.
  const canReset = viewer.canAtCompany('core.user:resetPassword');
  const canBlock = viewer.canAtCompany('core.user:block');
  const self = viewer.userId;
  const columns = useMemo(
    () => columnsOf({ self, canReset, canBlock }),
    [self, canReset, canBlock],
  );
  const show = (next: UserListSearch) => {
    navigate({ to: '.', search: next, replace: true });
  };
  const forbidden = page === undefined && isForbidden(error);
  // The API checks core.user:create at the company (its scope hook).
  const newUser = viewer.canAtCompany('core.user:create') ? (
    <Link to={coreLinks.settings.users.new({ companyId }).href} className={buttonVariants()}>
      <Plus aria-hidden />
      New user
    </Link>
  ) : undefined;
  let state: PageState = { status: 'ready' };
  if (forbidden) {
    state = noAccessState(
      'Users',
      'core.user:read',
      companyName,
      `a company admin of ${companyName}`,
    );
  } else if (page === undefined && error !== undefined) {
    state = {
      status: 'error',
      title: 'Could not load users',
      error,
      onRetry: () => refetch(),
    };
  } else if (shownPage === undefined) {
    state = { status: 'loading' };
  } else if (shownPage.totalCount === 0 && filtered) {
    state = {
      status: 'empty',
      title: 'No users match these filters',
      description: 'Change or clear the filters to see users again.',
      action: (
        <Button
          variant="link"
          onClick={() => {
            show(usersUnfiltered(view));
            document.getElementById(searchFieldId)?.focus();
          }}
        >
          Clear filters
        </Button>
      ),
    };
  } else if (shownPage.totalCount === 0 && view.q !== undefined) {
    state = {
      status: 'empty',
      title: 'No users match this search',
      description: 'Change or clear the search to see users again.',
      action: (
        <Button
          variant="link"
          onClick={() => {
            show(usersSearchedFor(view, ''));
            document.getElementById(searchFieldId)?.focus();
          }}
        >
          Clear search
        </Button>
      ),
    };
  } else if (shownPage.totalCount === 0) {
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
          <div className="flex flex-wrap items-center gap-2">
            <SearchField
              id={searchFieldId}
              label="Search users"
              value={view.q ?? ''}
              onSearch={(text) => show(usersSearchedFor(view, text))}
              className="w-full max-w-sm"
            />
            {roles.data !== undefined && (
              <FilterMenu
                label="Role"
                value={view.role}
                choices={[
                  { value: undefined, label: 'Any role' },
                  ...roles.data.coreRoles.map(({ id, name }) => ({ value: id, label: name })),
                ]}
                onChange={(role) => show(usersWithRole(view, role))}
              />
            )}
            <FilterMenu
              label="Status"
              value={view.status}
              choices={statusChoices}
              onChange={(status) => show(usersWithStatus(view, status))}
            />
          </div>
        )
      }
      state={state}
      busy={stale}
    >
      <DataTable
        label="Users"
        columns={columns}
        rows={shownPage?.edges.map(({ node }) => node) ?? []}
        getRowId={(user) => user.id}
        loading={shownPage === undefined}
        stale={stale}
        sort={userSortOf(view)}
        onSortChange={(sort) => show(usersSortedBy(view, sort))}
        paging={{
          page: view.page ?? 1,
          pageSize: userPageSize,
          totalCount: shownPage?.totalCount,
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
