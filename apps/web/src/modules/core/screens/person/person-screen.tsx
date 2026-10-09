// SPDX-License-Identifier: AGPL-3.0-or-later
import { coreLinks } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { PageFrame } from '../../../../ui/components/page-frame/index.ts';
import { usePlaces } from '../../use-places.ts';
import { useUser } from '../../use-user.tsx';
import { useViewer } from '../../use-viewer.ts';
import { UserStatus } from '../../user-status.tsx';
import { UserPermissions } from '../user/user-permissions.tsx';
import { UserRoles } from '../user/user-roles.tsx';

/**
 * A person's page in plant settings (design core-304, AS1, AS2, AS13, NO13 and NO21, ADR 0066): a
 * plant admin opens it from People and reads the person's roles at the plant and at its company,
 * with Remove at the plant where the reader may remove it and the line that a company admin can
 * remove a company role, and what the person can do at the plant, by module. Blocking and
 * resetting the password stay in company settings.
 */
export function PersonScreen() {
  const { plant } = useShell();
  const { user, state, forbidden, rolesForbidden } = useUser();
  const places = usePlaces();
  const viewer = useViewer();
  return (
    <PageFrame
      title={forbidden ? 'No access to People' : (user?.name ?? 'Person')}
      crumbs={[{ label: 'People', href: coreLinks.people({ plant }).href }]}
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
        <div className="flex flex-col gap-4">
          <UserRoles user={user} viewer={viewer} places={places} rolesForbidden={rolesForbidden} />
          <UserPermissions user={user} places={places} />
        </div>
      )}
    </PageFrame>
  );
}
