// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from '@apollo/client/react';
import { coreLinks } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { useNavigate } from '@tanstack/react-router';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { AssignRoleForm } from '../../components/assign-role-form/index.ts';
import { noAccessState } from '../../no-access.tsx';
import { CoreRoles } from '../../roles.graphql.ts';
import { usePlaces } from '../../use-places.ts';
import { useUser } from '../../use-user.tsx';
import { useViewer } from '../../use-viewer.ts';
import { CoreUser } from '../../user.graphql.ts';

/**
 * Add role for one person in plant settings (design core-304, AS3, AS14 and NO21, ADR 0066),
 * opened from the person's page: Role at this plant for the person the URL names, where the roles
 * the assigner does not hold at the plant stay with what they need (ADR 0010). An added role opens
 * the person's page in place of the form, with focus on its h1. A reader without
 * core.roleAssignment:manage at the plant gets "No access to Add role".
 */
export function PersonAddRoleScreen() {
  const { plant } = useShell();
  const navigate = useNavigate();
  const { user, state: userState } = useUser();
  const places = usePlaces();
  const viewer = useViewer();
  const roles = useQuery(CoreRoles);
  const plantName = places.plant?.name ?? plant;
  const forbidden = viewer.loaded && !viewer.can('core.roleAssignment:manage');
  let state: PageState = userState;
  if (forbidden) {
    state = noAccessState('Add role', 'core.roleAssignment:manage', plantName);
  } else if (
    userState.status === 'ready' &&
    roles.data === undefined &&
    roles.error !== undefined
  ) {
    state = {
      status: 'error',
      title: 'Could not load the roles',
      error: roles.error,
      onRetry: () => roles.refetch(),
    };
  } else if (
    userState.status === 'ready' &&
    (roles.data === undefined || !viewer.loaded || places.plant === undefined)
  ) {
    state = { status: 'loading' };
  }
  const people = { label: 'People', href: coreLinks.people({ plant }).href };
  const personHref =
    user === undefined ? undefined : coreLinks.people.person({ plant, userId: user.id }).href;
  return (
    <PageFrame
      title={
        forbidden
          ? 'No access to Add role'
          : user === undefined
            ? 'Add role'
            : `Add role for ${user.name}`
      }
      crumbs={
        user === undefined || personHref === undefined
          ? [people]
          : [people, { label: user.name, href: personHref }]
      }
      state={state}
    >
      {state.status === 'ready' &&
        user !== undefined &&
        personHref !== undefined &&
        roles.data !== undefined &&
        places.plant !== undefined && (
          <AssignRoleForm
            people={[user]}
            places={[{ ...places.plant, kind: 'PLANT' }]}
            companyName={places.company?.name ?? 'the company'}
            roles={roles.data.coreRoles}
            heldBy={() =>
              user.roleAssignments.map(({ role, scope }) => ({
                roleId: role?.id ?? '',
                scopeId: scope.id,
              }))
            }
            holds={(key) => viewer.can(key)}
            cancelHref={personHref}
            onAssigned={async () => {
              await navigate({ to: personHref, replace: true });
            }}
            writeAssignment={(cache, assignment) => {
              const variables = { id: user.id };
              const existing = cache.readQuery({ query: CoreUser, variables });
              if (existing?.coreUser) {
                cache.writeQuery({
                  query: CoreUser,
                  variables,
                  data: {
                    coreUser: {
                      ...existing.coreUser,
                      roleAssignments: [...existing.coreUser.roleAssignments, assignment],
                    },
                  },
                });
              }
              // What the person can do comes from the roles, and People lists the plant's roles,
              // so both are read again.
              cache.modify({
                id: cache.identify({ __typename: 'User', id: user.id }),
                fields: { effectivePermissions: (_value, { DELETE }) => DELETE },
              });
              cache.evict({ fieldName: 'corePlantRoleAssignments' });
            }}
          />
        )}
    </PageFrame>
  );
}
