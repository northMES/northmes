// SPDX-License-Identifier: AGPL-3.0-or-later
import { coreLinks } from '@northmes/core-contracts';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { Copy, Info, Pencil, Users } from 'lucide-react';
import { type ReactNode, useId } from 'react';
import { DataTable, type DataTableColumn } from '../../../../ui/components/data-table/index.ts';
import { DetailTabs } from '../../../../ui/components/detail-tabs/index.ts';
import { PageFrame } from '../../../../ui/components/page-frame/index.ts';
import { buttonVariants } from '../../../../ui/primitives/button.tsx';
import { rolePageSearch } from '../../access-search.ts';
import { permissionPhrase } from '../../no-access.tsx';
import { groupsOfKeys } from '../../permission-groups.ts';
import { permissionLine } from '../../permission-names.ts';
import { isCompanyAdmin, roleKind } from '../../role-kind.ts';
import { type Places, useCompanyId, usePlaces } from '../../use-places.ts';
import { type Role, useRole } from '../../use-role.tsx';
import { useViewer } from '../../use-viewer.ts';

/** A card of the role's page: a section named by its h2, with the line under it. */
function Card({
  title,
  description,
  children,
}: {
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6 text-card-foreground"
    >
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="text-base font-semibold">
          {title}
        </h2>
        {description !== undefined && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

/**
 * The permissions the role includes, by module, each as its plain line with its id (design
 * core-304, RO29 and RO41), read only, with the reason the reader cannot change them here.
 */
function PermissionsTab({
  role,
  readOnlyReason,
}: {
  readonly role: Role;
  readonly readOnlyReason?: string;
}) {
  const groups = groupsOfKeys(role.permissions);
  return (
    <div className="max-w-190">
      <Card
        title={`${role.permissions.length} ${role.permissions.length === 1 ? 'permission' : 'permissions'}`}
      >
        {readOnlyReason !== undefined && (
          <p className="text-sm text-muted-foreground">{readOnlyReason}</p>
        )}
        {groups.length === 0 && (
          <p className="text-sm text-muted-foreground">{role.name} includes no permission.</p>
        )}
        {groups.map((group) => (
          <div key={group.moduleId} className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold">{group.name}</h3>
            <ul className="flex flex-col gap-1 text-sm">
              {group.keys.map((key) => (
                <li key={key} className="flex flex-wrap gap-x-3">
                  <span>{permissionLine(key)}</span>
                  <span className="font-mono text-xs text-muted-foreground">{key}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Card>
    </div>
  );
}

/** "Nobody holds Shift lead at Acme AB." or "2 people hold Shift lead at Plant A." */
function holdersLine(count: number, role: string, place: string): string {
  if (count === 0) return `Nobody holds ${role} at ${place}.`;
  return `${count} ${count === 1 ? 'person holds' : 'people hold'} ${role} at ${place}.`;
}

/** One holder of the role at a place. */
type Holder = Role['holders'][number];

/** The person, a link to the Access tab of the person's page, and the username (RO21). */
function holderColumns(companyId: string): readonly DataTableColumn<Holder>[] {
  return [
    {
      id: 'person',
      header: 'Person',
      cell: ({ user }) => (
        <Link
          to={coreLinks.settings.users.user({ companyId, userId: user.id }, { tab: 'access' }).href}
          className="text-link underline underline-offset-2 hover:no-underline"
        >
          {user.name}
        </Link>
      ),
    },
    {
      id: 'username',
      header: 'Username',
      cell: ({ user }) => <span className="font-mono">{user.username}</span>,
    },
  ];
}

/**
 * The holders of the role at one place (RO21, RO25): a card headed "At Acme AB, all plants" or "At
 * Plant A", with the table of who holds the role there, or one empty line when nobody does.
 */
function HoldersAt({
  role,
  title,
  name,
  applies,
  holders,
}: {
  readonly role: Role;
  readonly title: string;
  readonly name: string;
  readonly applies: string;
  readonly holders: readonly Holder[];
}) {
  const companyId = useCompanyId() ?? '';
  if (holders.length === 0) {
    return (
      <Card title={title} description={applies}>
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Users aria-hidden className="size-5" />
          </span>
          <p className="text-sm font-semibold">{holdersLine(0, role.name, name)}</p>
        </div>
      </Card>
    );
  }
  return (
    <Card title={title} description={holdersLine(holders.length, role.name, name)}>
      <DataTable
        label={`Holders of ${role.name} at ${name}`}
        columns={holderColumns(companyId)}
        rows={holders}
        getRowId={(holder) => holder.id}
      />
    </Card>
  );
}

/**
 * Who holds the role at the company and at each of its plants (design core-304, RO21 and RO25),
 * read only: a card per place, then a note that the other plants list their own holders and that
 * roles are given and taken on a person's Access tab.
 */
function HoldersTab({ role, places }: { readonly role: Role; readonly places: Places }) {
  const companyId = useCompanyId() ?? '';
  const companyName = places.company?.name ?? 'the company';
  const at = (scopeId: string) => role.holders.filter(({ scope }) => scope.id === scopeId);
  return (
    <div className="flex flex-col gap-4">
      <HoldersAt
        role={role}
        title={`At ${companyName}, all plants`}
        name={companyName}
        applies={`A role assigned here applies to every plant of ${companyName}, also plants created later.`}
        holders={at(places.company?.id ?? companyId)}
      />
      {places.plants.map((plant) => (
        <HoldersAt
          key={plant.id}
          role={role}
          title={`At ${plant.name}`}
          name={plant.name}
          applies={`A role assigned here applies at ${plant.name} only.`}
          holders={at(plant.id)}
        />
      ))}
      <p className="flex items-start gap-2 rounded-lg bg-info-subtle px-4 py-3 text-sm">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-info" />
        Holders at the other plants of {companyName} are listed in the Administration of each plant.
        To add or remove a role, open the person and use the Access tab.
      </p>
    </div>
  );
}

/**
 * A role's page (design core-304, RO21, RO29 and RO41): the role's name in the h1 with its kind
 * beside it, Edit role for a custom role and New role from it for a reader who may create and edit
 * roles, except on Company admin while question 34 is open, and the tabs Permissions and
 * Holders, the open one in the URL's tab. History comes with the audit trail.
 */
export function RoleScreen() {
  const companyId = useCompanyId() ?? '';
  const navigate = useNavigate();
  const search = rolePageSearch(useSearch({ strict: false }));
  const { role, state, forbidden } = useRole();
  const places = usePlaces();
  const viewer = useViewer();
  // The API checks core.role:manage at the company (ADR 0010).
  const canManage = viewer.canAtCompany('core.role:manage');
  const companyName = places.company?.name ?? 'the company';
  const companyAdmin = role !== undefined && isCompanyAdmin(role);
  let readOnlyReason: string | undefined;
  if (companyAdmin) {
    readOnlyReason =
      'Company admin always holds every installed permission. The permission sync adds the permissions of modules installed later, so this role cannot be changed here.';
  } else if (role?.origin === 'MODULE') {
    readOnlyReason =
      'Default roles come from their module and cannot be changed here. To change one, create a role from it.';
  } else if (viewer.loaded && !canManage) {
    readOnlyReason = `Changing a role needs ${permissionPhrase('core.role:manage')} at ${companyName}.`;
  }
  return (
    <PageFrame
      title={forbidden ? 'No access to Roles' : (role?.name ?? 'Role')}
      crumbs={[{ label: 'Roles', href: coreLinks.settings.roles({ companyId }).href }]}
      meta={
        role === undefined ? undefined : (
          <span>{role.moduleId === null ? `Custom role, ${companyName}` : roleKind(role)}</span>
        )
      }
      actions={
        role !== undefined && canManage ? (
          <>
            {/* Question 34 of the design asks whether New role may start from Company admin. */}
            {!companyAdmin && (
              <Link
                to={coreLinks.settings.roles.new({ companyId }, { from: role.id }).href}
                className={buttonVariants({ variant: 'outline' })}
              >
                <Copy aria-hidden />
                New role from {role.name}
              </Link>
            )}
            {role.origin === 'CUSTOM' && (
              <Link
                to={coreLinks.settings.roles.role.edit({ companyId, roleId: role.id }).href}
                className={buttonVariants()}
              >
                <Pencil aria-hidden />
                Edit role
              </Link>
            )}
          </>
        ) : undefined
      }
      state={state}
    >
      {role !== undefined && (
        <DetailTabs
          label={role.name}
          value={search.tab ?? 'permissions'}
          onValueChange={(tab) =>
            navigate({ to: '.', search: tab === 'holders' ? { tab: 'holders' } : {} })
          }
          tabs={[
            {
              value: 'permissions',
              label: 'Permissions',
              content: <PermissionsTab role={role} readOnlyReason={readOnlyReason} />,
            },
            {
              value: 'holders',
              label: 'Holders',
              content: <HoldersTab role={role} places={places} />,
            },
          ]}
        />
      )}
    </PageFrame>
  );
}
