// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from '@apollo/client/react';
import { coreLinks } from '@northmes/core-contracts';
import { Link, useParams } from '@tanstack/react-router';
import { Building2, Factory, Lock, Plus, Shield } from 'lucide-react';
import { type ReactNode, useId } from 'react';
import { useIsMobile } from '../../../../ui/lib/use-mobile.ts';
import { buttonVariants } from '../../../../ui/primitives/button.tsx';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../../../../ui/primitives/empty.tsx';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/primitives/table.tsx';
import { RemoveRole, roleLoss } from '../../components/remove-role/index.ts';
import { permissionPhrase } from '../../no-access.tsx';
import { roleKind } from '../../role-kind.ts';
import { CoreRoles } from '../../roles.graphql.ts';
import { type Places, useCompanyId, useCompanyVariables } from '../../use-places.ts';
import type { User, UserAssignment } from '../../use-user.tsx';
import type { Viewer } from '../../use-viewer.ts';

interface UserRolesProps {
  readonly user: User;
  readonly viewer: Viewer;
  readonly places: Places;
  /** The API refused the roles, because the reader may not read roles (NO5). */
  readonly rolesForbidden: boolean;
}

/** The place of an assignment as the Where column says it: "Acme AB, all plants" or "Plant A". */
function whereOf({ scope }: UserAssignment, places: Places): string {
  return scope.kind === 'COMPANY'
    ? `${places.company?.name ?? scope.name}, all plants`
    : scope.name;
}

/**
 * Whether the reader may remove the assignment, as the API checks it (ADR 0010): the assignment
 * permission at its place, and every permission of its role there. A role the reader may not read
 * leaves the check to the API.
 */
function canRemove(assignment: UserAssignment, viewer: Viewer): boolean {
  const holds = assignment.scope.kind === 'COMPANY' ? viewer.canAtCompany : viewer.can;
  if (!holds('core.roleAssignment:manage')) return false;
  return assignment.role?.permissions.every(holds) ?? true;
}

/** The id of a role link in the table, which takes focus after the row above it was removed. */
function roleLinkId(assignment: UserAssignment): string {
  return `user-role-${assignment.id}`;
}

/** The id of Add role, which takes focus after the last row was removed. */
const addRoleId = 'user-add-role';

/**
 * The role of an assignment: its name with its kind under it, or No access (NO5). The name links to
 * the role's page in company settings for a reader who holds core.role:read at the company, which
 * that page needs; for anyone else, such as a Plant admin on a person's page, it is plain text.
 */
function RoleCell({
  assignment,
  companyName,
  kindOf,
  companyId,
  linked,
}: {
  readonly assignment: UserAssignment;
  readonly companyName: string;
  /** The kind of a role by its id, once the company's roles loaded. */
  readonly kindOf: (roleId: string) => string | undefined;
  /** The company whose settings hold the role's page. */
  readonly companyId: string;
  /** The reader may open the role's page in company settings. */
  readonly linked: boolean;
}) {
  const { role } = assignment;
  if (role === null) {
    return (
      <span className="flex items-center gap-1 text-muted-foreground">
        <Lock aria-hidden className="size-3.5" />
        No access
        <span className="sr-only">
          . Roles need {permissionPhrase('core.role:read')} at {companyName}.
        </span>
      </span>
    );
  }
  return (
    <span className="flex flex-col">
      {linked ? (
        <Link
          id={roleLinkId(assignment)}
          to={coreLinks.settings.roles.role({ companyId, roleId: role.id }).href}
          className="text-link underline underline-offset-2 hover:no-underline"
        >
          {role.name}
        </Link>
      ) : (
        // Focus lands here after Remove of the row above, so the name takes focus by script.
        <span id={roleLinkId(assignment)} tabIndex={-1} className="self-start">
          {role.name}
        </span>
      )}
      <span className="text-xs text-muted-foreground">{kindOf(role.id)}</span>
    </span>
  );
}

/** The place of an assignment with its icon: a factory for a plant, a building for the company. */
function WhereCell({
  assignment,
  places,
  userId,
}: {
  readonly assignment: UserAssignment;
  readonly places: Places;
  readonly userId: string;
}) {
  const Icon = assignment.scope.kind === 'COMPANY' ? Building2 : Factory;
  // In company settings a plant links to the person's page in that plant's settings.
  const plant =
    places.plant === undefined && assignment.scope.kind === 'PLANT'
      ? places.plants.find(({ id }) => id === assignment.scope.id)
      : undefined;
  return (
    <span className="flex items-center gap-2">
      <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      {plant === undefined ? (
        whereOf(assignment, places)
      ) : (
        <Link
          to={coreLinks.people.person({ plant: plant.slug, userId }).href}
          className="text-link underline underline-offset-2 hover:no-underline"
        >
          {whereOf(assignment, places)}
        </Link>
      )}
    </span>
  );
}

/**
 * The Roles card of the Access tab in company settings (design core-304, AS1, AS11, AS21, NO5
 * and NO13, ADR 0066): the user's roles at the plants and at the company, the plant roles first,
 * each with its kind and its place, and Remove for a reader who may remove it, or the line that
 * names who can. Add role leads to the Add role page. A user without a role gets the empty state
 * that says so. At 320 px each role is a card. A reader without core.role:read sees No access in
 * each Role cell, and Remove is named by the place only.
 */
export function UserRoles({ user, viewer, places, rolesForbidden }: UserRolesProps) {
  const companyId = useCompanyId() ?? places.company?.id ?? '';
  const { plant: plantSlug } = useParams({ strict: false });
  const headingId = useId();
  const isMobile = useIsMobile();
  // A role's kind comes from the company's roles, which the roles pages read too.
  const companyRoles = useQuery(CoreRoles, {
    variables: useCompanyVariables(),
    skip: rolesForbidden,
  }).data?.coreRoles;
  const kindOf = (roleId: string) => {
    const role = companyRoles?.find(({ id }) => id === roleId);
    return role === undefined ? undefined : roleKind(role);
  };
  const companyName = places.company?.name ?? 'the company';
  const linked = viewer.canAtCompany('core.role:read');
  // In plant settings the page reads the plant and its company (design core-304, AS1).
  const plantName = places.plant?.name;
  const canAdd =
    viewer.can('core.roleAssignment:manage') && viewer.can('core.role:read') && !rolesForbidden;
  // The plant roles first, then those of the company (AS1).
  const assignments = [...user.roleAssignments].sort(
    (a, b) => Number(a.scope.kind === 'COMPANY') - Number(b.scope.kind === 'COMPANY'),
  );
  const action = (assignment: UserAssignment, index: number) => {
    const next = assignments[index + 1];
    if (canRemove(assignment, viewer)) {
      return (
        <RemoveRole
          person={user}
          assignment={assignment}
          {...roleLoss(assignment, user.roleAssignments, user.name)}
          focusAfter={() =>
            (next === undefined ? null : document.getElementById(roleLinkId(next))) ??
            document.getElementById(addRoleId) ??
            document.querySelector<HTMLElement>('h1')
          }
        />
      );
    }
    return assignment.scope.kind === 'COMPANY' ? (
      <span className="text-sm text-muted-foreground">
        A company admin of {companyName} can remove it.
      </span>
    ) : null;
  };
  let body: ReactNode;
  if (assignments.length === 0) {
    body = (
      <Empty className="gap-2 py-8">
        <EmptyHeader>
          <EmptyMedia className="size-10 rounded-full bg-muted text-muted-foreground">
            <Shield aria-hidden className="size-5" />
          </EmptyMedia>
          <EmptyTitle>
            <h3 className="text-sm font-semibold">
              {plantName === undefined
                ? `${user.name} holds no role at ${companyName} or its plants.`
                : `${user.name} holds no role at ${plantName} or at ${companyName}.`}
            </h3>
          </EmptyTitle>
          <EmptyDescription>
            {plantName === undefined
              ? `Add a role so that ${user.name} can work at ${companyName} and its plants.`
              : `Add a role so that ${user.name} can work at ${plantName}.`}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  } else if (isMobile) {
    body = (
      <ul aria-label={`Roles of ${user.name}`} className="flex flex-col gap-3">
        {assignments.map((assignment, index) => (
          <li
            key={assignment.id}
            className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm"
          >
            <RoleCell
              assignment={assignment}
              companyName={companyName}
              kindOf={kindOf}
              companyId={companyId}
              linked={linked}
            />
            <WhereCell assignment={assignment} places={places} userId={user.id} />
            <span className="self-start">{action(assignment, index)}</span>
          </li>
        ))}
      </ul>
    );
  } else {
    body = (
      <Table>
        <TableCaption className="sr-only">Roles of {user.name}</TableCaption>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead scope="col">Role</TableHead>
            <TableHead scope="col">Where</TableHead>
            <TableHead scope="col">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assignments.map((assignment, index) => (
            <TableRow key={assignment.id}>
              <TableCell>
                <RoleCell
                  assignment={assignment}
                  companyName={companyName}
                  kindOf={kindOf}
                  companyId={companyId}
                  linked={linked}
                />
              </TableCell>
              <TableCell>
                <WhereCell assignment={assignment} places={places} userId={user.id} />
              </TableCell>
              <TableCell className="text-right whitespace-normal">
                {action(assignment, index)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6 text-card-foreground"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id={headingId} className="text-base font-semibold">
            Roles
          </h2>
          <p className="text-sm text-muted-foreground">
            {plantName === undefined
              ? `${user.name}'s roles at ${companyName} and its plants.`
              : `${user.name}'s roles that apply at ${plantName}.`}
          </p>
        </div>
        {canAdd && (
          <Link
            id={addRoleId}
            to={
              plantSlug === undefined
                ? coreLinks.settings.users.user.addRole({ companyId, userId: user.id }).href
                : coreLinks.people.addRole({ plant: plantSlug }).href
            }
            className={buttonVariants({ variant: 'outline' })}
          >
            <Plus aria-hidden />
            Add role
          </Link>
        )}
      </div>
      {body}
    </section>
  );
}
