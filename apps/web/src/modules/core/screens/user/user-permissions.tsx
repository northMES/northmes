// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from '@apollo/client/react';
import { Lock } from 'lucide-react';
import { type ReactNode, useId, useState } from 'react';
import { isForbidden } from '../../../../ui/lib/graphql-errors.ts';
import { Checkbox } from '../../../../ui/primitives/checkbox.tsx';
import { Field, FieldLabel } from '../../../../ui/primitives/field.tsx';
import { Skeleton } from '../../../../ui/primitives/skeleton.tsx';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/primitives/table.tsx';
import { ForbiddenRegion } from '../../no-access.tsx';
import { groupsOfKeys } from '../../permission-groups.ts';
import { permissionLine } from '../../permission-names.ts';
import { type Places, useCompanyId } from '../../use-places.ts';
import type { User } from '../../use-user.tsx';
import { CoreUserPermissions, type CoreUserPermissionsQuery } from './user-permissions.graphql.ts';

/** One permission with the assignments that grant it at the company. */
type Effective = NonNullable<CoreUserPermissionsQuery['coreUser']>['effectivePermissions'][number];

interface UserPermissionsProps {
  readonly user: User;
  readonly places: Places;
}

/** "Shift lead at Plant A, Viewer at Acme AB": the roles and places behind a permission. */
function grantedBy({ grantedBy: grants }: Effective): string {
  return grants
    .map(({ role, scope }) => `${role?.name ?? 'No access'} at ${scope.name}`)
    .join(', ');
}

/**
 * What the user can do at the company of company settings (design core-304, AS1, AS9, AS21 and
 * AS25, ADR 0066): by module, each permission a role of theirs at the company grants, with the role
 * behind it; a role at one plant grants nothing at the company. Show every permission adds the
 * others, each with No access and a lock, which a screen reader hears with the reason.
 * Without core.role:read the region keeps its heading and names the permission it needs.
 */
export function UserPermissions({ user, places }: UserPermissionsProps) {
  const companyId = useCompanyId() ?? '';
  const headingId = useId();
  const everyId = useId();
  const [every, setEvery] = useState(false);
  const { data, error } = useQuery(CoreUserPermissions, {
    variables: { id: user.id, companyId },
  });
  const companyName = places.company?.name ?? 'the company';
  const title = `What ${user.name} can do at ${companyName}`;
  const effective = data?.coreUser?.effectivePermissions.filter(
    ({ permission }) => permission.installed,
  );
  let body: ReactNode;
  if (effective === undefined && isForbidden(error)) {
    body = (
      <ForbiddenRegion
        title={`You cannot see what ${user.name} can do here`}
        permission="core.role:read"
        plant={companyName}
      />
    );
  } else if (effective === undefined && error !== undefined) {
    body = (
      <p role="alert" className="text-sm text-destructive">
        Could not load what {user.name} can do. Check the connection, then reload the page.
      </p>
    );
  } else if (effective === undefined) {
    body = (
      <div className="flex flex-col gap-2">
        {['a', 'b', 'c'].map((key) => (
          <Skeleton key={key} aria-hidden className="h-4 w-72 motion-reduce:animate-none" />
        ))}
      </div>
    );
  } else if (user.roleAssignments.length === 0) {
    body = <p className="text-sm">Permissions come from roles. Add a role above.</p>;
  } else {
    const byKey = new Map(effective.map((entry) => [entry.permission.key, entry]));
    const shown = effective
      .filter((entry) => every || entry.grantedBy.length > 0)
      .map(({ permission }) => permission.key);
    const noAccessReason = `No role of ${user.name} at ${companyName} includes it.`;
    body = (
      <>
        <Field orientation="horizontal" className="w-auto">
          <Checkbox id={everyId} checked={every} onCheckedChange={(next) => setEvery(next)} />
          <FieldLabel htmlFor={everyId}>Show every permission</FieldLabel>
        </Field>
        {groupsOfKeys(shown).map((group) => {
          const granted = group.keys.filter(
            (key) => (byKey.get(key)?.grantedBy.length ?? 0) > 0,
          ).length;
          return (
            <Table key={group.moduleId}>
              <TableCaption className="text-left text-sm font-semibold text-foreground caption-top">
                {group.name}
                {every && (
                  <span className="font-normal text-muted-foreground">
                    {' '}
                    {granted} of {group.keys.length}
                  </span>
                )}
              </TableCaption>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="col">Permission</TableHead>
                  <TableHead scope="col">Granted by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.keys.map((key) => {
                  const entry = byKey.get(key);
                  return (
                    <TableRow key={key}>
                      <TableCell className="whitespace-normal">
                        <span className="flex flex-col">
                          <span>{permissionLine(key)}</span>
                          <span className="font-mono text-xs text-muted-foreground">{key}</span>
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        {entry !== undefined && entry.grantedBy.length > 0 ? (
                          grantedBy(entry)
                        ) : (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Lock aria-hidden className="size-3.5" />
                            No access
                            <span className="sr-only">. {noAccessReason}</span>
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          );
        })}
        {shown.length === 0 && (
          <p className="text-sm">
            No role of {user.name} grants a permission at {companyName}.
          </p>
        )}
      </>
    );
  }
  return (
    <section
      aria-labelledby={headingId}
      aria-busy={(effective === undefined && error === undefined) || undefined}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6 text-card-foreground"
    >
      <h2 id={headingId} className="text-base font-semibold">
        {title}
      </h2>
      {body}
    </section>
  );
}
