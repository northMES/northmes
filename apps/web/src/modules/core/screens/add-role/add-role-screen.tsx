// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from '@apollo/client/react';
import { coreLinks } from '@northmes/core-contracts';
import { useNavigate } from '@tanstack/react-router';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { type AssignPlace, AssignRoleForm } from '../../components/assign-role-form/index.ts';
import { noAccessState } from '../../no-access.tsx';
import { CoreRoles } from '../../roles.graphql.ts';
import { useCompanyId, usePlaces } from '../../use-places.ts';
import { useUser } from '../../use-user.tsx';
import { useViewer } from '../../use-viewer.ts';
import { CoreUser } from '../../user.graphql.ts';

/**
 * Add role in company settings (design core-304, AS3, AS5, AS14, NO21 to NO23, ADR 0066): Where
 * (one plant of the company, or the company and all its plants), then Role, where the roles the
 * assigner cannot give at that place stay with what they need. An added role opens the user's
 * Access tab in place of the form.
 */
export function AddRoleScreen() {
  const companyId = useCompanyId() ?? '';
  const navigate = useNavigate();
  const { user, state: userState } = useUser();
  const places = usePlaces();
  const viewer = useViewer();
  const { data, error, refetch } = useQuery(CoreRoles, { variables: { companyId } });
  const roles = data?.coreRoles;
  const companyName = places.company?.name ?? 'the company';
  const forbidden = viewer.loaded && !viewer.canAtCompany('core.roleAssignment:manage');
  let state: PageState = userState;
  if (forbidden) {
    state = noAccessState(
      'Add role',
      'core.roleAssignment:manage',
      companyName,
      `a company admin of ${companyName}`,
    );
  } else if (userState.status === 'ready' && roles === undefined && error !== undefined) {
    state = {
      status: 'error',
      title: 'Could not load the roles',
      error,
      onRetry: () => refetch(),
    };
  } else if (
    userState.status === 'ready' &&
    (roles === undefined || !viewer.loaded || places.company === undefined)
  ) {
    state = { status: 'loading' };
  }
  const users = { label: 'Users', href: coreLinks.settings.users({ companyId }).href };
  const access =
    user === undefined
      ? undefined
      : coreLinks.settings.users.user({ companyId, userId: user.id }, { tab: 'access' }).href;
  const where: AssignPlace[] = [
    ...places.plants.map((plant) => ({ ...plant, kind: 'PLANT' as const })),
    ...(places.company === undefined ? [] : [{ ...places.company, kind: 'COMPANY' as const }]),
  ];
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
        user === undefined || access === undefined
          ? [users]
          : [users, { label: user.name, href: access }]
      }
      state={state}
    >
      {state.status === 'ready' &&
        user !== undefined &&
        access !== undefined &&
        roles !== undefined && (
          <AssignRoleForm
            people={[user]}
            places={where}
            companyName={companyName}
            roles={roles}
            heldBy={() =>
              user.roleAssignments.map(({ role, scope }) => ({
                roleId: role?.id ?? '',
                scopeId: scope.id,
              }))
            }
            holds={(key, place) =>
              place.kind === 'COMPANY' ? viewer.canAtCompany(key) : viewer.can(key)
            }
            cancelHref={access}
            onAssigned={async () => {
              await navigate({ to: access, replace: true });
            }}
            writeAssignment={(cache, assignment) => {
              const variables = { id: user.id, companyId };
              const existing = cache.readQuery({ query: CoreUser, variables });
              if (!existing?.coreUser) return;
              const assignments = [...existing.coreUser.roleAssignments, assignment];
              cache.writeQuery({
                query: CoreUser,
                variables,
                data: {
                  coreUser: {
                    ...existing.coreUser,
                    // The company's roles first, as the API lists them.
                    roleAssignments: assignments.sort(
                      (a, b) => Number(a.scope.kind === 'PLANT') - Number(b.scope.kind === 'PLANT'),
                    ),
                  },
                },
              });
            }}
          />
        )}
    </PageFrame>
  );
}
