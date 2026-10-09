// SPDX-License-Identifier: AGPL-3.0-or-later
import { coreLinks } from '@northmes/core-contracts';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { Copy, Pencil } from 'lucide-react';
import { type ReactNode, useId } from 'react';
import { DetailTabs } from '../../../../ui/components/detail-tabs/index.ts';
import { PageFrame } from '../../../../ui/components/page-frame/index.ts';
import { StatusBadge } from '../../../../ui/components/status-badge/index.ts';
import { buttonVariants } from '../../../../ui/primitives/button.tsx';
import { rolePageSearch } from '../../access-search.ts';
import { permissionPhrase } from '../../no-access.tsx';
import { groupsOfKeys } from '../../permission-groups.ts';
import { moduleName, permissionLine } from '../../permission-names.ts';
import { type Places, useCompanyId, usePlaces } from '../../use-places.ts';
import { type Role, useRole } from '../../use-role.tsx';
import { useViewer } from '../../use-viewer.ts';

/** A card of the role's page: a section named by its h2. */
function Card({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="flex max-w-190 flex-col gap-3 rounded-xl border border-border bg-card p-6 text-card-foreground"
    >
      <h2 id={headingId} className="text-base font-semibold">
        {title}
      </h2>
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
  );
}

/** "Nobody holds Shift lead at Acme AB." or "2 people hold Shift lead at Plant A." */
function holdersLine(count: number, role: string, place: string): string {
  if (count === 0) return `Nobody holds ${role} at ${place}.`;
  return `${count} ${count === 1 ? 'person holds' : 'people hold'} ${role} at ${place}.`;
}

/**
 * Who holds the role at the company and at each of its plants (design core-304, RO21 and RO25),
 * read only: roles are given and taken on a person's Access tab.
 */
function HoldersTab({ role, places }: { readonly role: Role; readonly places: Places }) {
  const companyId = useCompanyId() ?? '';
  const where = [
    { id: places.company?.id ?? companyId, name: places.company?.name ?? 'the company' },
    ...places.plants,
  ];
  return (
    <Card title="Holders">
      {where.map(({ id, name }) => {
        const holders = role.holders.filter(({ scope }) => scope.id === id);
        return (
          <div key={id} className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold">{name}</h3>
            <p className="text-sm text-muted-foreground">
              {holdersLine(holders.length, role.name, name)}
            </p>
            {holders.length > 0 && (
              <ul className="flex flex-col gap-1 text-sm">
                {holders.map(({ id, user }) => (
                  <li key={id}>
                    <Link
                      to={
                        coreLinks.settings.users.user(
                          { companyId, userId: user.id },
                          { tab: 'access' },
                        ).href
                      }
                      className="text-link underline underline-offset-2 hover:no-underline"
                    >
                      {user.name}
                    </Link>{' '}
                    <span className="text-muted-foreground">{user.username}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
      <p className="text-sm text-muted-foreground">
        To add or remove a role, open the person and use the Access tab.
      </p>
    </Card>
  );
}

/**
 * A role's page (design core-304, RO21, RO29 and RO41): the role's name in the h1 with its kind,
 * Edit role for a custom role and New role from it for a reader who may create and edit roles,
 * and the tabs Permissions and Holders, the open one in the URL's tab. History comes with the
 * audit trail.
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
  let readOnlyReason: string | undefined;
  if (role?.origin === 'MODULE') {
    readOnlyReason = `Default roles come from their module and cannot be changed. To change one, make a new role from it.`;
  } else if (viewer.loaded && !canManage) {
    readOnlyReason = `Changing roles needs ${permissionPhrase('core.role:manage')} at ${companyName}.`;
  }
  return (
    <PageFrame
      title={forbidden ? 'No access to Roles' : (role?.name ?? 'Role')}
      crumbs={[{ label: 'Roles', href: coreLinks.settings.roles({ companyId }).href }]}
      actions={
        role !== undefined && canManage ? (
          <>
            <Link
              to={coreLinks.settings.roles.new({ companyId }, { from: role.id }).href}
              className={buttonVariants({ variant: 'outline' })}
            >
              <Copy aria-hidden />
              New role from {role.name}
            </Link>
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
        <>
          <p>
            <StatusBadge tone="neutral">
              {role.moduleId === null
                ? `Custom role of ${companyName}`
                : `Default role from ${moduleName(role.moduleId)}`}
            </StatusBadge>
          </p>
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
        </>
      )}
    </PageFrame>
  );
}
