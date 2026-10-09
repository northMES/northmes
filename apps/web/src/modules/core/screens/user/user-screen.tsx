// SPDX-License-Identifier: AGPL-3.0-or-later
import { coreLinks } from '@northmes/core-contracts';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { DetailTabs } from '../../../../ui/components/detail-tabs/index.ts';
import { PageFrame } from '../../../../ui/components/page-frame/index.ts';
import { userPageSearch } from '../../access-search.ts';
import { forgetTemporaryPassword, temporaryPasswordOf } from '../../temporary-password.ts';
import { useCompanyId, usePlaces } from '../../use-places.ts';
import { type User, useUser } from '../../use-user.tsx';
import { useViewer } from '../../use-viewer.ts';
import { UserStatus } from '../../user-status.tsx';
import { TemporaryPasswordDialog } from './temporary-password-dialog.tsx';
import { UserActions } from './user-actions.tsx';
import { UserPermissions } from './user-permissions.tsx';
import { UserRoles } from './user-roles.tsx';

/** The General tab: the user's name, username and status. */
function General({ user }: { readonly user: User }) {
  return (
    <section
      aria-labelledby="user-identity"
      className="max-w-190 rounded-xl border border-border bg-card p-6 text-card-foreground"
    >
      <h2 id="user-identity" className="text-base font-semibold">
        Identity
      </h2>
      <dl className="mt-4 grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-6 gap-y-3 text-sm">
        <dt className="text-muted-foreground">Name</dt>
        <dd>{user.name}</dd>
        <dt className="text-muted-foreground">Username</dt>
        <dd className="font-mono">{user.username}</dd>
        <dt className="text-muted-foreground">Status</dt>
        <dd>
          <UserStatus blocked={user.blocked} />
        </dd>
      </dl>
    </section>
  );
}

/**
 * The temporary password of a user created a moment ago, shown once (US17): the dialog opens with
 * the page, and once it closes the password is forgotten.
 */
function useTemporaryPassword(userId: string | undefined) {
  const [password] = useState(() =>
    userId === undefined ? undefined : temporaryPasswordOf(userId),
  );
  const [open, setOpen] = useState(password !== undefined);
  return {
    password,
    open,
    close: () => {
      setOpen(false);
      if (userId !== undefined) forgetTemporaryPassword(userId);
    },
  };
}

/**
 * A user's page (design core-304, AS1, AS11 and US11 to US18): the name in the h1 with the
 * username and the StatusBadge, Reset password and Block user or Unblock user in the page actions
 * for a reader who may reset passwords or block users, never on your own page, and the tabs General and Access, the open one in the URL's tab. The Access tab
 * holds the user's roles at the company and its plants, and what they can do at the company. A
 * user created a moment ago shows the temporary password once. History comes with the audit
 * trail.
 */
export function UserScreen() {
  const companyId = useCompanyId() ?? '';
  const navigate = useNavigate();
  const { userId } = useParams({ strict: false });
  const search = userPageSearch(useSearch({ strict: false }));
  const { user, state, forbidden, rolesForbidden } = useUser();
  const places = usePlaces();
  const viewer = useViewer();
  const temporary = useTemporaryPassword(userId);
  // The API checks core.user:block and core.user:resetPassword at the company, and at every other
  // company the user belongs to. Neither applies to your own account.
  const other = user !== undefined && viewer.userId !== undefined && user.id !== viewer.userId;
  const canBlock = other && viewer.canAtCompany('core.user:block');
  const canReset = other && viewer.canAtCompany('core.user:resetPassword');
  return (
    <PageFrame
      title={forbidden ? 'No access to Users' : (user?.name ?? 'User')}
      crumbs={[{ label: 'Users', href: coreLinks.settings.users({ companyId }).href }]}
      actions={
        user !== undefined && (canBlock || canReset) ? (
          <UserActions user={user} canBlock={canBlock} canReset={canReset} />
        ) : undefined
      }
      meta={
        user === undefined ? undefined : (
          <>
            <UserStatus blocked={user.blocked} />
            <span className="font-mono">{user.username}</span>
          </>
        )
      }
      state={state}
    >
      {user !== undefined && (
        <>
          <DetailTabs
            label={user.name}
            value={search.tab ?? 'general'}
            onValueChange={(tab) =>
              navigate({ to: '.', search: tab === 'access' ? { tab: 'access' } : {} })
            }
            tabs={[
              { value: 'general', label: 'General', content: <General user={user} /> },
              {
                value: 'access',
                label: 'Access',
                content: (
                  <>
                    <UserRoles
                      user={user}
                      viewer={viewer}
                      places={places}
                      rolesForbidden={rolesForbidden}
                    />
                    <UserPermissions user={user} places={places} />
                  </>
                ),
              },
            ]}
          />
          {temporary.password !== undefined && (
            <TemporaryPasswordDialog
              name={user.name}
              password={temporary.password}
              open={temporary.open}
              onClose={temporary.close}
            />
          )}
        </>
      )}
    </PageFrame>
  );
}
