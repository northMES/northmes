// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from '@apollo/client/react';
import { coreLinks } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useId, useMemo } from 'react';
import { DataTable, type DataTableColumn } from '../../../../ui/components/data-table/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { isForbidden } from '../../../../ui/lib/graphql-errors.ts';
import { buttonVariants } from '../../../../ui/primitives/button.tsx';
import {
  CorePermissionCatalog,
  type CorePermissionCatalogQuery,
} from '../../components/permission-checklist/permission-catalog.graphql.ts';
import { noAccessState, permissionPhrase } from '../../no-access.tsx';
import { moduleName } from '../../permission-names.ts';
import { CoreRoles, type CoreRolesQuery } from '../../roles.graphql.ts';
import { usePlaces } from '../../use-places.ts';
import { useViewer } from '../../use-viewer.ts';

/** One role of the list. */
type RoleRow = CoreRolesQuery['coreRoles'][number];

/** The role's name, the link to its page. */
function RoleLink({ role }: { readonly role: RoleRow }) {
  const { plant } = useShell();
  return (
    <Link
      to={coreLinks.roles.role({ plant, roleId: role.id }).href}
      className="text-link underline underline-offset-2 hover:no-underline"
    >
      {role.name}
    </Link>
  );
}

/** The installed and the not installed permissions of the catalog, by key. */
interface Installed {
  readonly installed: ReadonlySet<string>;
  readonly notInstalled: ReadonlySet<string>;
}

/** The keys of the catalog's permissions, split by whether their module is installed. */
function installedOf(catalog: CorePermissionCatalogQuery['corePermissionCatalog']): Installed {
  const permissions = catalog.flatMap(({ resources }) =>
    resources.flatMap(({ permissions }) => permissions),
  );
  return {
    installed: new Set(permissions.filter((each) => each.installed).map(({ key }) => key)),
    notInstalled: new Set(permissions.filter((each) => !each.installed).map(({ key }) => key)),
  };
}

/**
 * How many of the installed permissions the role holds, "5 of 36", with "1 not installed" under
 * it for the permissions of modules that are not installed (RO1). Until the catalog loads, the
 * count alone.
 */
function PermissionCount({
  role,
  installed,
}: {
  readonly role: RoleRow;
  readonly installed: Installed | undefined;
}) {
  if (installed === undefined) return <span className="font-mono">{role.permissions.length}</span>;
  const held = role.permissions.filter((key) => installed.installed.has(key)).length;
  const missing = role.permissions.filter((key) => installed.notInstalled.has(key)).length;
  return (
    <span className="flex flex-col">
      <span className="font-mono">
        {held} of {installed.installed.size}
      </span>
      {missing > 0 && (
        <span className="text-xs text-muted-foreground">{missing} not installed</span>
      )}
    </span>
  );
}

/** "None", "1 person" or "3 people": the people who hold the role, each counted once. */
function holdersCount(role: RoleRow): string {
  const people = new Set(role.holders.map(({ user }) => user.id)).size;
  if (people === 0) return 'None';
  return `${people} ${people === 1 ? 'person' : 'people'}`;
}

/**
 * The columns of a group of roles: Defined by names the company or the role's module, Permissions
 * counts the installed permissions the role holds, and the holders column counts the people who
 * hold the role at the company or at the plant.
 */
function columnsOf(
  companyName: string,
  plantName: string,
  installed: Installed | undefined,
): readonly DataTableColumn<RoleRow>[] {
  return [
    { id: 'name', header: 'Role', cell: (role) => <RoleLink role={role} /> },
    {
      id: 'definedBy',
      header: 'Defined by',
      cell: (role) => (role.moduleId === null ? companyName : moduleName(role.moduleId)),
    },
    {
      id: 'permissions',
      header: 'Permissions',
      cell: (role) => <PermissionCount role={role} installed={installed} />,
    },
    { id: 'holders', header: `Held at ${companyName} and ${plantName}`, cell: holdersCount },
  ];
}

/** A group of the list under its h2, such as Custom roles of Acme AB. */
function RoleGroup({
  title,
  rows,
  columns,
  loading,
  emptyTitle,
  empty,
}: {
  readonly title: string;
  readonly rows: readonly RoleRow[];
  readonly columns: readonly DataTableColumn<RoleRow>[];
  readonly loading: boolean;
  /** The heading of the empty group, when it has one. */
  readonly emptyTitle?: string;
  readonly empty: string;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h2 id={headingId} className="text-base font-semibold">
        {title}
      </h2>
      {!loading && rows.length === 0 ? (
        <div className="flex flex-col gap-1 text-sm">
          {emptyTitle !== undefined && <h3 className="font-semibold">{emptyTitle}</h3>}
          <p className="text-muted-foreground">{empty}</p>
        </div>
      ) : (
        <DataTable
          label={title}
          columns={columns}
          rows={rows}
          getRowId={(role) => role.id}
          loading={loading}
        />
      )}
    </section>
  );
}

/**
 * The roles of the company (design core-304, RO1): the count beside the h1, then its custom roles
 * and the default roles of the modules, each by name, with who defines them, how many of the
 * installed permissions they hold ("5 of 36") and how many people hold them at the company and at
 * the plant ("1 person"). New role shows to a user who may create and edit roles; another reader
 * gets a line that says why it is missing (RO27). No custom roles yet draws RO7. A reader without
 * core.role:read gets the page "No access to Roles" (NO1).
 */
export function RolesScreen() {
  const { plant } = useShell();
  const places = usePlaces();
  const viewer = useViewer();
  const { data, error, refetch } = useQuery(CoreRoles);
  const roles = data?.coreRoles;
  const catalog = useQuery(CorePermissionCatalog).data?.corePermissionCatalog;
  const installed = useMemo(
    () => (catalog === undefined ? undefined : installedOf(catalog)),
    [catalog],
  );
  const companyName = places.company?.name ?? 'the company';
  const plantName = places.plant?.name ?? plant;
  const forbidden = roles === undefined && isForbidden(error);
  let state: PageState = { status: 'ready' };
  if (forbidden) {
    state = noAccessState('Roles', 'core.role:read', plantName);
  } else if (roles === undefined && error !== undefined) {
    state = {
      status: 'error',
      title: 'Could not load roles',
      description: 'Check the connection, then try again.',
      onRetry: () => {
        refetch().catch(() => {});
      },
    };
  } else if (roles === undefined) {
    state = { status: 'loading' };
  }
  // The API checks core.role:manage at the company (ADR 0010).
  const canManage = viewer.canAtCompany('core.role:manage');
  const columns = useMemo(
    () => columnsOf(companyName, plantName, installed),
    [companyName, plantName, installed],
  );
  const loading = roles === undefined;
  return (
    <PageFrame
      title={forbidden ? 'No access to Roles' : 'Roles'}
      actions={
        canManage ? (
          <Link to={coreLinks.roles.new({ plant }).href} className={buttonVariants()}>
            <Plus aria-hidden />
            New role
          </Link>
        ) : undefined
      }
      meta={
        roles === undefined ? undefined : (
          <span>
            {roles.length} {roles.length === 1 ? 'role' : 'roles'} at {companyName}
          </span>
        )
      }
      toolbar={
        !forbidden && viewer.loaded && !canManage ? (
          <p className="text-sm text-muted-foreground">
            Creating or changing a role needs {permissionPhrase('core.role:manage')} at{' '}
            {companyName}. A company admin of {companyName} has it.
          </p>
        ) : undefined
      }
      state={state}
    >
      <div className="flex flex-col gap-6">
        <RoleGroup
          title={`Custom roles of ${companyName}`}
          rows={roles?.filter(({ origin }) => origin === 'CUSTOM') ?? []}
          columns={columns}
          loading={loading}
          emptyTitle="No custom roles yet"
          empty={`${companyName} uses the default roles of its modules. Create a role when a job needs another set of permissions, starting from a default role or from none.`}
        />
        <RoleGroup
          title="Default roles from modules"
          rows={roles?.filter(({ origin }) => origin === 'MODULE') ?? []}
          columns={columns}
          loading={loading}
          empty="No module defines a default role."
        />
      </div>
    </PageFrame>
  );
}
