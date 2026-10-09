// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from '@apollo/client/react';
import { Building2, Factory, Lock, type LucideIcon, ShieldCheck } from 'lucide-react';
import { type ReactNode, useId, useMemo, useState } from 'react';
import {
  DataTable,
  type DataTableColumn,
  type DataTableGroup,
} from '../../../../ui/components/data-table/index.ts';
import { ErrorState } from '../../../../ui/components/page-frame/index.ts';
import { isForbidden } from '../../../../ui/lib/graphql-errors.ts';
import { Checkbox } from '../../../../ui/primitives/checkbox.tsx';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../../../../ui/primitives/empty.tsx';
import { Field, FieldLabel } from '../../../../ui/primitives/field.tsx';
import { Skeleton } from '../../../../ui/primitives/skeleton.tsx';
import { ForbiddenRegion } from '../../no-access.tsx';
import { groupsOfKeys } from '../../permission-groups.ts';
import { moduleOf, permissionLine } from '../../permission-names.ts';
import { type Places, useCompanyId } from '../../use-places.ts';
import type { User } from '../../use-user.tsx';
import { CoreUserPermissions, type CoreUserPermissionsQuery } from './user-permissions.graphql.ts';

/** One permission with the assignments that grant it at the company. */
type Effective = NonNullable<CoreUserPermissionsQuery['coreUser']>['effectivePermissions'][number];

interface UserPermissionsProps {
  readonly user: User;
  readonly places: Places;
}

/** One row of the table: a permission and the assignments that grant it. */
interface PermissionRow {
  readonly key: string;
  readonly entry: Effective | undefined;
}

/** The roles and places behind a permission, each a chip with its place's icon (AS1). */
function GrantedBy({ entry }: { readonly entry: Effective }) {
  return (
    <span className="flex flex-wrap gap-2">
      {entry.grantedBy.map(({ id, role, scope }) => {
        const Icon = scope.kind === 'COMPANY' ? Building2 : Factory;
        return (
          <span
            key={id}
            className="inline-flex items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 text-xs"
          >
            <Icon aria-hidden className="size-3.5 text-muted-foreground" />
            {role?.name ?? 'No access'} at {scope.name}
          </span>
        );
      })}
    </span>
  );
}

/** A heading and a line in the card, for what the user can do when there is nothing to list. */
function CardState({
  icon: Icon,
  title,
  description,
}: {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly description: string;
}) {
  return (
    <Empty className="gap-2 py-8">
      <EmptyHeader>
        <EmptyMedia className="size-10 rounded-full bg-muted text-muted-foreground">
          <Icon aria-hidden className="size-5" />
        </EmptyMedia>
        <EmptyTitle>
          <h3 className="text-sm font-semibold">{title}</h3>
        </EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

/**
 * What the user can do at the company of company settings (design core-304, AS1, AS9, AS21, AS23
 * and AS25, ADR 0066): one table by module, each permission a role of theirs at the company
 * grants, with the roles behind it as chips; a role at one plant grants nothing at the company.
 * Each module counts what it grants, "4", and with Show every permission, at the card's top right,
 * "4 of 11" and the others with No access and a lock, which a screen reader hears with the reason.
 * A user without a role gets "Lena Ek can do nothing at Acme AB yet."; a failed load the error
 * with its correlation id and Try again, which keeps focus while it reloads. Without core.role:read
 * the region keeps its heading and names the permission it needs.
 */
export function UserPermissions({ user, places }: UserPermissionsProps) {
  const companyId = useCompanyId() ?? '';
  const headingId = useId();
  const everyId = useId();
  const [every, setEvery] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const { data, error, refetch } = useQuery(CoreUserPermissions, {
    variables: { id: user.id, companyId },
  });
  const companyName = places.company?.name ?? 'the company';
  const title = `What ${user.name} can do at ${companyName}`;
  const effective = data?.coreUser?.effectivePermissions.filter(
    ({ permission }) => permission.installed,
  );
  const noAccessReason = `No role of ${user.name} at ${companyName} includes it.`;
  const columns = useMemo<readonly DataTableColumn<PermissionRow>[]>(
    () => [
      {
        id: 'permission',
        header: 'Permission',
        cell: ({ key }) => (
          <span className="flex flex-col">
            <span>{permissionLine(key)}</span>
            <span className="font-mono text-xs text-muted-foreground">{key}</span>
          </span>
        ),
      },
      {
        id: 'grantedBy',
        header: 'Granted by',
        cell: ({ entry }) =>
          entry !== undefined && entry.grantedBy.length > 0 ? (
            <GrantedBy entry={entry} />
          ) : (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Lock aria-hidden className="size-3.5" />
              No access
              <span className="sr-only">. {noAccessReason}</span>
            </span>
          ),
      },
    ],
    [noAccessReason],
  );
  let body: ReactNode;
  let toggle = false;
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
      <ErrorState
        title={`Could not load what ${user.name} can do`}
        error={error}
        retrying={retrying}
        onRetry={async () => {
          setRetrying(true);
          try {
            await refetch();
          } finally {
            setRetrying(false);
          }
        }}
      />
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
    body = (
      <CardState
        icon={ShieldCheck}
        title={`${user.name} can do nothing at ${companyName} yet.`}
        description="Permissions come from roles. Add a role above."
      />
    );
  } else {
    toggle = true;
    const byKey = new Map(effective.map((entry) => [entry.permission.key, entry]));
    const shown = effective
      .filter((entry) => every || entry.grantedBy.length > 0)
      .map(({ permission }) => permission.key);
    const groups: DataTableGroup<PermissionRow>[] = groupsOfKeys(shown).map((group) => {
      const all = effective.filter(({ permission }) => moduleOf(permission.key) === group.moduleId);
      const granted = all.filter(({ grantedBy: grants }) => grants.length > 0).length;
      return {
        id: group.moduleId,
        label: group.name,
        count: every ? `${granted} of ${all.length}` : String(granted),
        rows: group.keys.map((key) => ({ key, entry: byKey.get(key) })),
      };
    });
    body =
      shown.length === 0 ? (
        <p className="text-sm">
          No role of {user.name} grants a permission at {companyName}.
        </p>
      ) : (
        <DataTable
          label={title}
          columns={columns}
          rows={[]}
          groups={groups}
          getRowId={({ key }) => key}
        />
      );
  }
  return (
    <section
      aria-labelledby={headingId}
      aria-busy={(effective === undefined && error === undefined) || undefined}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6 text-card-foreground"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id={headingId} className="text-base font-semibold">
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">
            Every permission of the roles above, by module. A change applies from {user.name}'s next
            action.
          </p>
        </div>
        {toggle && (
          <Field orientation="horizontal" className="w-auto">
            <Checkbox id={everyId} checked={every} onCheckedChange={(next) => setEvery(next)} />
            <FieldLabel htmlFor={everyId}>Show every permission</FieldLabel>
          </Field>
        )}
      </div>
      {body}
    </section>
  );
}
