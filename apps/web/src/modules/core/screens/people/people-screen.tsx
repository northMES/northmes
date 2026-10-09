// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from '@apollo/client/react';
import { coreLinks } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link } from '@tanstack/react-router';
import { Lock, Plus } from 'lucide-react';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { isForbidden } from '../../../../ui/lib/graphql-errors.ts';
import { buttonVariants } from '../../../../ui/primitives/button.tsx';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/primitives/table.tsx';
import { noAccessState, permissionPhrase } from '../../no-access.tsx';
import { usePlaces } from '../../use-places.ts';
import { useViewer, type Viewer } from '../../use-viewer.ts';
import { PeopleRemove } from './people-remove.tsx';
import {
  CorePlantRoleAssignments,
  type PlantAssignment,
} from './plant-role-assignments.graphql.ts';

/** The id of Add role, which takes focus after the last row was removed. */
const addRoleId = 'people-add-role';

/** The id of a row's Remove, which takes focus after the row above it was removed. */
function removeId(assignment: PlantAssignment): string {
  return `people-remove-${assignment.id}`;
}

/**
 * Whether the reader may remove the role at the plant, as the API checks it (ADR 0010): the
 * assignment permission there, and every permission of the role there. A role the reader may not
 * read leaves the check to the API.
 */
function canRemove(assignment: PlantAssignment, viewer: Viewer): boolean {
  if (!viewer.can('core.roleAssignment:manage')) return false;
  return assignment.role?.permissions.every(viewer.can) ?? true;
}

/**
 * People in plant settings (ADR 0066, the maintainer's decision of 2026-10-09): who holds a role
 * at the plant, one row per role, by the person's name, with Remove at this plant for a reader who
 * may remove it, and Add role, which gives a person of the company a role at the plant. A plant
 * admin manages the plant's people here; the roles that apply at every plant are given in company
 * settings. The plant-scope grant rule applies: a role whose permissions the reader does not hold
 * at the plant cannot be given or taken here. A reader without core.user:read gets the page "No
 * access to People".
 */
export function PeopleScreen() {
  const { plant } = useShell();
  const places = usePlaces();
  const viewer = useViewer();
  const { data, error, refetch } = useQuery(CorePlantRoleAssignments, { errorPolicy: 'all' });
  const assignments = data?.corePlantRoleAssignments;
  const plantName = places.plant?.name ?? plant;
  const companyName = places.company?.name ?? 'the company';
  const forbidden = assignments === undefined && isForbidden(error);
  const canAdd = viewer.can('core.roleAssignment:manage') && viewer.can('core.role:read');
  const addRoleLink = (id?: string) =>
    canAdd ? (
      <Link id={id} to={coreLinks.people.addRole({ plant }).href} className={buttonVariants()}>
        <Plus aria-hidden />
        Add role
      </Link>
    ) : undefined;
  let state: PageState = { status: 'ready' };
  if (forbidden) {
    state = noAccessState('People', 'core.user:read', plantName);
  } else if (assignments === undefined && error !== undefined) {
    state = {
      status: 'error',
      title: 'Could not load people',
      error,
      onRetry: () => refetch(),
    };
  } else if (assignments === undefined) {
    state = { status: 'loading' };
  } else if (assignments.length === 0) {
    state = {
      status: 'empty',
      title: `Nobody holds a role at ${plantName} yet`,
      description: `Give a person of ${companyName} a role at ${plantName}, and they show here.`,
      action: addRoleLink(),
    };
  }
  const rows = assignments ?? [];
  return (
    <PageFrame
      title={forbidden ? 'No access to People' : 'People'}
      actions={addRoleLink(addRoleId)}
      toolbar={
        forbidden ? undefined : (
          <p className="text-sm text-muted-foreground">
            Who holds a role at {plantName}. Roles that apply at every plant of {companyName} are
            given in company settings.
          </p>
        )
      }
      state={state}
    >
      <Table>
        <TableCaption className="sr-only">People at {plantName}</TableCaption>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead scope="col">Name</TableHead>
            <TableHead scope="col">Username</TableHead>
            <TableHead scope="col">Role</TableHead>
            <TableHead scope="col">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody aria-busy={assignments === undefined || undefined}>
          {rows.map((assignment, index) => {
            const next = rows[index + 1];
            const { user, role } = assignment;
            return (
              <TableRow key={assignment.id}>
                <TableCell>
                  <Link
                    to={coreLinks.people.person({ plant, userId: user.id }).href}
                    className="text-link underline underline-offset-2 hover:no-underline"
                  >
                    {user.name}
                  </Link>
                </TableCell>
                <TableCell className="font-mono">{user.username}</TableCell>
                <TableCell>
                  {role === null ? (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Lock aria-hidden className="size-3.5" />
                      No access
                      <span className="sr-only">
                        . Roles need {permissionPhrase('core.role:read')} at {plantName}.
                      </span>
                    </span>
                  ) : (
                    role.name
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {canRemove(assignment, viewer) && (
                    <span id={removeId(assignment)} className="inline-flex">
                      <PeopleRemove
                        assignment={assignment}
                        label={`Remove ${role?.name ?? 'role'} at ${plantName} from ${user.name}`}
                        focusAfter={() =>
                          (next === undefined
                            ? null
                            : document
                                .getElementById(removeId(next))
                                ?.querySelector<HTMLElement>('button')) ??
                          document.getElementById(addRoleId) ??
                          document.querySelector<HTMLElement>('h1')
                        }
                      />
                    </span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </PageFrame>
  );
}
