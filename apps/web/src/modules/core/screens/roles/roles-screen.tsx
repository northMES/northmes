// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from '@apollo/client/react';
import { coreLinks } from '@northmes/core-contracts';
import { Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useId, useMemo } from 'react';
import { DataTable, type DataTableColumn } from '../../../../ui/components/data-table/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { isForbidden } from '../../../../ui/lib/graphql-errors.ts';
import { buttonVariants } from '../../../../ui/primitives/button.tsx';
import { noAccessState, permissionPhrase } from '../../no-access.tsx';
import { moduleName } from '../../permission-names.ts';
import { CoreRoles, type CoreRolesQuery } from '../../roles.graphql.ts';
import { useCompanyId, usePlaces } from '../../use-places.ts';
import { useViewer } from '../../use-viewer.ts';

/** One role of the list. */
type RoleRow = CoreRolesQuery['coreRoles'][number];

/** The role's name, the link to its page. */
function RoleLink({ role }: { readonly role: RoleRow }) {
  const companyId = useCompanyId() ?? '';
  return (
    <Link
      to={coreLinks.settings.roles.role({ companyId, roleId: role.id }).href}
      className="text-link underline underline-offset-2 hover:no-underline"
    >
      {role.name}
    </Link>
  );
}

/**
 * The columns of a group of roles: Defined by names the company or the role's module, and Holders
 * counts the people who hold the role at the company or at one of its plants.
 */
function columnsOf(companyName: string): readonly DataTableColumn<RoleRow>[] {
  return [
    { id: 'name', header: 'Role', cell: (role) => <RoleLink role={role} /> },
    {
      id: 'definedBy',
      header: 'Defined by',
      cell: (role) => (role.moduleId === null ? companyName : moduleName(role.moduleId)),
    },
    { id: 'permissions', header: 'Permissions', cell: (role) => role.permissions.length },
    {
      id: 'holders',
      header: 'Holders',
      cell: (role) => role.holders.length,
    },
  ];
}

/** A group of the list under its h2, such as Custom roles of Acme AB. */
function RoleGroup({
  title,
  rows,
  columns,
  loading,
  empty,
}: {
  readonly title: string;
  readonly rows: readonly RoleRow[];
  readonly columns: readonly DataTableColumn<RoleRow>[];
  readonly loading: boolean;
  readonly empty: string;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h2 id={headingId} className="text-base font-semibold">
        {title}
      </h2>
      {!loading && rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
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
 * The roles of the company in company settings (design core-304, RO1): its custom roles, then
 * the default roles of the modules, each by name, with who defines them, how many permissions they
 * hold and how many people hold them at the company and its plants. New role shows to a user who
 * may create and edit roles; another reader gets a line that says why it is missing (RO27). A
 * reader without core.role:read gets the page "No access to Roles" (NO1).
 */
export function RolesScreen() {
  const companyId = useCompanyId() ?? '';
  const places = usePlaces();
  const viewer = useViewer();
  const { data, error, refetch } = useQuery(CoreRoles, { variables: { companyId } });
  const roles = data?.coreRoles;
  const companyName = places.company?.name ?? 'the company';
  const forbidden = roles === undefined && isForbidden(error);
  let state: PageState = { status: 'ready' };
  if (forbidden) {
    state = noAccessState(
      'Roles',
      'core.role:read',
      companyName,
      `a company admin of ${companyName}`,
    );
  } else if (roles === undefined && error !== undefined) {
    state = {
      status: 'error',
      title: 'Could not load roles',
      error,
      onRetry: () => refetch(),
    };
  } else if (roles === undefined) {
    state = { status: 'loading' };
  }
  // The API checks core.role:manage at the company (ADR 0010).
  const canManage = viewer.canAtCompany('core.role:manage');
  const columns = useMemo(() => columnsOf(companyName), [companyName]);
  const loading = roles === undefined;
  return (
    <PageFrame
      title={forbidden ? 'No access to Roles' : 'Roles'}
      actions={
        canManage ? (
          <Link to={coreLinks.settings.roles.new({ companyId }).href} className={buttonVariants()}>
            <Plus aria-hidden />
            New role
          </Link>
        ) : undefined
      }
      toolbar={
        forbidden ? undefined : (
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            {roles !== undefined && (
              <p>
                {roles.length} {roles.length === 1 ? 'role' : 'roles'} at {companyName}
              </p>
            )}
            {viewer.loaded && !canManage && (
              <p>
                Creating and editing roles needs {permissionPhrase('core.role:manage')} at{' '}
                {companyName}.
              </p>
            )}
          </div>
        )
      }
      state={state}
    >
      <div className="flex flex-col gap-6">
        <RoleGroup
          title={`Custom roles of ${companyName}`}
          rows={roles?.filter(({ origin }) => origin === 'CUSTOM') ?? []}
          columns={columns}
          loading={loading}
          empty="No custom roles yet. A custom role holds the permissions you choose from the modules."
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
