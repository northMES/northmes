// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from '@apollo/client/react';
import { coreLinks } from '@northmes/core-contracts';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { ChevronDown, Copy, Ellipsis, Pencil, Plus, SlidersHorizontal } from 'lucide-react';
import { useId, useMemo } from 'react';
import {
  DataTable,
  type DataTableColumn,
  type DataTableGroup,
} from '../../../../ui/components/data-table/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { SearchField } from '../../../../ui/components/search-field/index.ts';
import { isForbidden } from '../../../../ui/lib/graphql-errors.ts';
import { useIsMobile } from '../../../../ui/lib/use-mobile.ts';
import { Button, buttonVariants } from '../../../../ui/primitives/button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../../../../ui/primitives/dropdown-menu.tsx';
import { Label } from '../../../../ui/primitives/label.tsx';
import { RadioGroup, RadioGroupItem } from '../../../../ui/primitives/radio-group.tsx';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../../../../ui/primitives/sheet.tsx';
import {
  CorePermissionCatalog,
  type CorePermissionCatalogQuery,
} from '../../components/permission-checklist/permission-catalog.graphql.ts';
import { noAccessState, permissionPhrase } from '../../no-access.tsx';
import { moduleName } from '../../permission-names.ts';
import { isCompanyAdmin } from '../../role-kind.ts';
import { type RoleListSearch, roleListSearch, rolesOfView } from '../../role-list-search.ts';
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
function PermissionCount({ role }: { readonly role: RoleRow }) {
  const companyId = useCompanyId() ?? '';
  const catalog = useQuery(CorePermissionCatalog, { variables: { companyId } }).data
    ?.corePermissionCatalog;
  const installed = useMemo(
    () => (catalog === undefined ? undefined : installedOf(catalog)),
    [catalog],
  );
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

/** Who defines the role: the company for a custom role, else its module. */
function DefinedBy({ role }: { readonly role: RoleRow }) {
  const places = usePlaces();
  return role.moduleId === null ? (places.company?.name ?? '') : moduleName(role.moduleId);
}

/**
 * The columns of the list: Defined by names the company or the role's module, Permissions counts
 * the installed permissions the role holds, and Holders counts the people who hold the role at
 * the company or at one of its plants. They are constants, because a new cell renderer would
 * mount every cell again, and an open row menu with it.
 */
const columns: readonly DataTableColumn<RoleRow>[] = [
  {
    id: 'name',
    header: 'Role',
    sortable: true,
    sticky: true,
    cell: (role) => <RoleLink role={role} />,
  },
  { id: 'definedBy', header: 'Defined by', cell: (role) => <DefinedBy role={role} /> },
  { id: 'permissions', header: 'Permissions', cell: (role) => <PermissionCount role={role} /> },
  { id: 'holders', header: 'Holders', cell: holdersCount },
];

/**
 * The row menu of a role (design core-304, RO35 to RO38): "Actions for Shift lead" opens a menu
 * with focus on its first item. A custom role offers Edit role and New role from it, a default
 * role New role from it. Company admin gets none while question 34 is open.
 */
function RoleActions({ role }: { readonly role: RoleRow }) {
  const companyId = useCompanyId() ?? '';
  const navigate = useNavigate();
  if (isCompanyAdmin(role)) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={`Actions for ${role.name}`}>
            <Ellipsis aria-hidden />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-62">
        {role.origin === 'CUSTOM' && (
          <DropdownMenuItem
            onClick={() =>
              navigate({
                to: coreLinks.settings.roles.role.edit({ companyId, roleId: role.id }).href,
              })
            }
          >
            <Pencil aria-hidden />
            Edit role
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={() =>
            navigate({ to: coreLinks.settings.roles.new({ companyId }, { from: role.id }).href })
          }
        >
          <Copy aria-hidden />
          New role from {role.name}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The columns with the row menus, for a reader who may create and edit roles. */
const columnsWithActions: readonly DataTableColumn<RoleRow>[] = [
  ...columns,
  {
    id: 'actions',
    header: 'Actions',
    headerHidden: true,
    cell: (role) => <RoleActions role={role} />,
  },
];

/** The id of Search roles, where Clear filters moves focus. */
const searchFieldId = 'roles-search';

/** One choice of Defined by: custom, or a module's id, with the name it shows. */
interface DefinedByOption {
  readonly value: string;
  readonly label: string;
}

/** The choices of Defined by: the company for its custom roles, then each module by name. */
function definedByOptions(roles: readonly RoleRow[], companyName: string): DefinedByOption[] {
  const modules = new Set(roles.flatMap(({ moduleId }) => (moduleId === null ? [] : [moduleId])));
  return [
    { value: 'custom', label: companyName },
    ...[...modules]
      .map((moduleId) => ({ value: moduleId, label: moduleName(moduleId) }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  ];
}

/** The value of the All roles choice, which clears Defined by. */
const allRoles = '';

/**
 * Defined by (RO1): a button that opens a menu of radio items, All roles, the company and each
 * module; the button names the choice beside its label.
 */
function DefinedByMenu({
  options,
  value,
  onChange,
}: {
  readonly options: readonly DefinedByOption[];
  readonly value: string | undefined;
  readonly onChange: (value: string | undefined) => void;
}) {
  const chosen = options.find((option) => option.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" aria-label="Defined by">
            Defined by
            {chosen !== undefined && <span className="font-normal">: {chosen.label}</span>}
            <ChevronDown aria-hidden />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="min-w-56">
        <DropdownMenuRadioGroup
          value={value ?? allRoles}
          onValueChange={(next: string) => onChange(next === allRoles ? undefined : next)}
        >
          <DropdownMenuRadioItem value={allRoles} closeOnClick>
            All roles
          </DropdownMenuRadioItem>
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value} closeOnClick>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Filters at 320 px (NO11): a button that opens the Filters sheet, which holds Defined by. */
function FiltersSheet({
  options,
  value,
  onChange,
}: {
  readonly options: readonly DefinedByOption[];
  readonly value: string | undefined;
  readonly onChange: (value: string | undefined) => void;
}) {
  const labelId = useId();
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" />}>
        <SlidersHorizontal aria-hidden />
        Filters
      </SheetTrigger>
      <SheetContent side="bottom" className="p-4">
        <SheetHeader className="p-0">
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>
        <p id={labelId} className="text-xs font-semibold">
          Defined by
        </p>
        <RadioGroup
          aria-labelledby={labelId}
          value={value ?? allRoles}
          onValueChange={(next) => onChange(next === allRoles ? undefined : String(next))}
          className="flex flex-col gap-2"
        >
          {[{ value: allRoles, label: 'All roles' }, ...options].map((option) => (
            <Label key={option.value} className="flex min-h-9 items-center gap-3 font-normal">
              <RadioGroupItem value={option.value} />
              {option.label}
            </Label>
          ))}
        </RadioGroup>
      </SheetContent>
    </Sheet>
  );
}

/** "1 group, 2 roles": the footer of the table. */
function footerOf(groups: number, roles: number): string {
  return `${groups} ${groups === 1 ? 'group' : 'groups'}, ${roles} ${roles === 1 ? 'role' : 'roles'}`;
}

/** "5 roles": the count beside a group's name. */
function countOf(roles: number): string {
  return `${roles} ${roles === 1 ? 'role' : 'roles'}`;
}

/**
 * The roles of the company in company settings (design core-304, RO1 to RO4, RO33, NO11 and
 * NO12): the count beside the h1, Search roles and Defined by, then one table with the group
 * "Custom roles of Acme AB" and the group "Default roles from modules", each with its count, and
 * the footer "2 groups, 11 roles". Each role shows who defines it, how many of the installed
 * permissions it holds ("5 of 36") and how many people hold it at the company and its plants.
 * Role sorts by name. Search, Defined by and the sort live in the URL. At 320 px Defined by moves
 * into the Filters sheet and the table scrolls sideways in its own region with Role sticky. New
 * role shows to a user who may create and edit roles; another reader gets a line that says why
 * it is missing (RO27). A reader without core.role:read gets the page "No access to Roles" (NO1).
 */
export function RolesScreen() {
  const companyId = useCompanyId() ?? '';
  const view = roleListSearch(useSearch({ strict: false }));
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const places = usePlaces();
  const viewer = useViewer();
  const { data, error, refetch } = useQuery(CoreRoles, { variables: { companyId } });
  const roles = data?.coreRoles;
  const companyName = places.company?.name ?? 'the company';
  const forbidden = roles === undefined && isForbidden(error);
  const show = (next: RoleListSearch) => {
    navigate({ to: '.', search: next, replace: true });
  };
  const shown = rolesOfView(roles ?? [], view);
  const filtered = view.q !== undefined || view.definedBy !== undefined;
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
  } else if (filtered && shown.length === 0) {
    state = {
      status: 'empty',
      title: 'No roles match these filters',
      description: 'Change or clear the filters to see roles again.',
      action: (
        <Button
          variant="link"
          onClick={() => {
            show({ ...(view.sort !== undefined && { sort: view.sort }) });
            document.getElementById(searchFieldId)?.focus();
          }}
        >
          Clear filters
        </Button>
      ),
    };
  }
  // The API checks core.role:manage at the company (ADR 0010).
  const canManage = viewer.canAtCompany('core.role:manage');
  const custom = shown.filter(({ origin }) => origin === 'CUSTOM');
  const defaults = shown.filter(({ origin }) => origin === 'MODULE');
  const groups: DataTableGroup<RoleRow>[] = [];
  if (!filtered || custom.length > 0) {
    groups.push({
      id: 'custom',
      label: `Custom roles of ${companyName}`,
      count: countOf(custom.length),
      rows: custom,
      empty: (
        <span className="flex flex-col gap-1">
          <span className="font-semibold">No custom roles yet</span>
          <span className="text-muted-foreground">
            {companyName} uses the default roles of its modules. Create a role when a job needs
            another set of permissions, starting from a default role or from none.
          </span>
        </span>
      ),
    });
  }
  if (!filtered || defaults.length > 0) {
    groups.push({
      id: 'module',
      label: 'Default roles from modules',
      count: countOf(defaults.length),
      rows: defaults,
      empty: 'No module defines a default role.',
    });
  }
  const options = definedByOptions(roles ?? [], companyName);
  const filter = (definedBy: string | undefined) =>
    show({
      ...(view.q !== undefined && { q: view.q }),
      ...(definedBy !== undefined && { definedBy }),
      ...(view.sort !== undefined && { sort: view.sort }),
    });
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
      meta={
        roles === undefined ? undefined : (
          <span>
            {roles.length} {roles.length === 1 ? 'role' : 'roles'} at {companyName}
          </span>
        )
      }
      toolbar={
        forbidden ? undefined : (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <SearchField
                id={searchFieldId}
                label="Search roles"
                value={view.q ?? ''}
                onSearch={(text) =>
                  show({
                    ...(text !== '' && { q: text }),
                    ...(view.definedBy !== undefined && { definedBy: view.definedBy }),
                    ...(view.sort !== undefined && { sort: view.sort }),
                  })
                }
                className="w-full max-w-sm"
              />
              {isMobile ? (
                <FiltersSheet options={options} value={view.definedBy} onChange={filter} />
              ) : (
                <DefinedByMenu options={options} value={view.definedBy} onChange={filter} />
              )}
            </div>
            {viewer.loaded && !canManage && (
              <p className="text-sm text-muted-foreground">
                Creating or changing a role needs {permissionPhrase('core.role:manage')} at{' '}
                {companyName}. A company admin of {companyName} has it.
              </p>
            )}
          </div>
        )
      }
      state={state}
    >
      <DataTable
        label="Roles"
        columns={canManage ? columnsWithActions : columns}
        rows={[]}
        groups={groups}
        getRowId={(role) => role.id}
        loading={roles === undefined}
        sort={{ id: 'name', desc: view.sort === '-name' }}
        onSortChange={(sort) =>
          show({
            ...(view.q !== undefined && { q: view.q }),
            ...(view.definedBy !== undefined && { definedBy: view.definedBy }),
            ...(sort.desc && { sort: '-name' as const }),
          })
        }
        footer={footerOf(groups.length, shown.length)}
        scrollLabel={isMobile ? 'Roles table, scrolls sideways' : undefined}
      />
    </PageFrame>
  );
}
