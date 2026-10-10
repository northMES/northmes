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
import { useViewer } from '../../use-viewer.ts';
import { CorePlantRoleAssignments } from '../people/plant-role-assignments.graphql.ts';
import { CoreUsers } from './users.graphql.ts';

/**
 * Add role of People in plant settings (ADR 0066): Person, a user of the plant's company, then
 * Role at this plant, where the roles the assigner does not hold at the plant stay with what they
 * need, as the plant-scope grant rule asks (ADR 0010). An added role opens People in place of the
 * form. A reader without core.roleAssignment:manage at the plant gets "No access to Add role".
 */
export function PeopleAddRoleScreen() {
  const { plant } = useShell();
  const navigate = useNavigate();
  const places = usePlaces();
  const viewer = useViewer();
  const users = useQuery(CoreUsers);
  const roles = useQuery(CoreRoles);
  const held = useQuery(CorePlantRoleAssignments, { errorPolicy: 'all' });
  const plantName = places.plant?.name ?? plant;
  const people = coreLinks.people({ plant }).href;
  const forbidden = viewer.loaded && !viewer.can('core.roleAssignment:manage');
  const failed = [users, roles].find(
    ({ data, error }) => data === undefined && error !== undefined,
  );
  let state: PageState = { status: 'ready' };
  if (forbidden) {
    state = noAccessState('Add role', 'core.roleAssignment:manage', plantName);
  } else if (failed !== undefined) {
    state = {
      status: 'error',
      title: 'Could not load the people and roles',
      description: 'Check the connection, then try again.',
      onRetry: () => {
        failed.refetch().catch(() => {});
      },
    };
  } else if (
    users.data === undefined ||
    roles.data === undefined ||
    !viewer.loaded ||
    places.plant === undefined
  ) {
    state = { status: 'loading' };
  }
  return (
    <PageFrame
      title={forbidden ? 'No access to Add role' : `Add role at ${plantName}`}
      crumbs={[{ label: 'People', href: people }]}
      state={state}
    >
      {state.status === 'ready' &&
        users.data !== undefined &&
        roles.data !== undefined &&
        places.plant !== undefined && (
          <AssignRoleForm
            people={users.data.coreUsers.edges.map(({ node }) => node)}
            places={[{ ...places.plant, kind: 'PLANT' }]}
            companyName={places.company?.name ?? 'the company'}
            roles={roles.data.coreRoles}
            heldBy={(personId) =>
              (held.data?.corePlantRoleAssignments ?? [])
                .filter(({ user }) => user.id === personId)
                .map(({ role, scope }) => ({ roleId: role?.id ?? '', scopeId: scope.id }))
            }
            holds={(key) => viewer.can(key)}
            cancelHref={people}
            onAssigned={async () => {
              await navigate({ to: people, replace: true });
            }}
            writeAssignment={(cache) => {
              // People reads the plant's roles again, in the API's order.
              cache.evict({ fieldName: 'corePlantRoleAssignments' });
            }}
          />
        )}
    </PageFrame>
  );
}
