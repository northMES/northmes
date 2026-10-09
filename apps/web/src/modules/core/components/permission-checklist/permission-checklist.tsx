// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from '@apollo/client/react';
import { useShell } from '@northmes/web-sdk';
import { ChevronDown, Lock } from 'lucide-react';
import { useId } from 'react';
import { StatusBadge } from '../../../../ui/components/status-badge/index.ts';
import { fieldId } from '../../../../ui/lib/field-id.ts';
import { Checkbox } from '../../../../ui/primitives/checkbox.tsx';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../../../../ui/primitives/collapsible.tsx';
import { Skeleton } from '../../../../ui/primitives/skeleton.tsx';
import { moduleName, permissionLine } from '../../permission-names.ts';
import { usePlaces } from '../../use-places.ts';
import { useViewer } from '../../use-viewer.ts';
import {
  CorePermissionCatalog,
  type CorePermissionCatalogQuery,
} from './permission-catalog.graphql.ts';

/** The permissions of one module, in the catalog's order. */
interface PermissionGroup {
  readonly moduleId: string;
  readonly name: string;
  readonly keys: readonly string[];
}

/**
 * The installed permissions of the catalog by module, core first: a permission of a module that
 * is not installed never shows (design core-304, Permission ids shown on the page).
 */
function installedGroups(
  catalog: CorePermissionCatalogQuery['corePermissionCatalog'],
): PermissionGroup[] {
  return catalog
    .map(({ moduleId, resources }) => ({
      moduleId,
      name: moduleName(moduleId),
      keys: resources.flatMap(({ permissions }) =>
        permissions.filter(({ installed }) => installed).map(({ key }) => key),
      ),
    }))
    .filter(({ keys }) => keys.length > 0);
}

export interface PermissionChecklistProps {
  /** The ticked permission keys. */
  readonly value: readonly string[];
  readonly onChange: (value: string[]) => void;
  /** The role the new role starts from, whose permissions the difference compares with. */
  readonly baseline?: { readonly name: string; readonly permissions: readonly string[] };
  /** The save refused these permissions: each is marked invalid. */
  readonly refused?: readonly string[];
}

interface RowProps {
  readonly permission: string;
  readonly checked: boolean;
  readonly locked: boolean;
  readonly invalid: boolean;
  readonly lockedReason: string;
  readonly onCheckedChange: (checked: boolean) => void;
}

/**
 * One permission: a checkbox named by its plain line and described by its id. A permission the
 * editor does not hold at the plant is locked: a Lock in place of the checkbox, aria-disabled and
 * no Tab stop, described by why (design core-304, NO19).
 */
function PermissionRow({
  permission,
  checked,
  locked,
  invalid,
  lockedReason,
  onCheckedChange,
}: RowProps) {
  const labelId = useId();
  const idId = useId();
  const reasonId = useId();
  const describedBy = locked ? `${idId} ${reasonId}` : idId;
  return (
    <li className="flex min-h-9 items-start gap-3 py-1.5">
      {locked ? (
        // A disabled native checkbox keeps the state and the name for assistive technology and
        // takes no Tab stop; the Lock stands in its place on screen (design core-304, NO19).
        <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center text-muted-foreground">
          <input
            type="checkbox"
            disabled
            checked={checked}
            readOnly
            aria-labelledby={labelId}
            aria-describedby={describedBy}
            className="sr-only"
          />
          <Lock aria-hidden className="size-4" />
        </span>
      ) : (
        <Checkbox
          id={fieldId(`permissions.${permission}`)}
          className="mt-0.5"
          checked={checked}
          onCheckedChange={(next) => onCheckedChange(next)}
          aria-labelledby={labelId}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
        />
      )}
      <span className="flex min-w-0 flex-col gap-0.5 text-sm">
        <span id={labelId}>{permissionLine(permission)}</span>
        <span id={idId} className="font-mono text-xs break-all text-muted-foreground">
          {permission}
        </span>
        {locked && (
          <span id={reasonId} className="text-xs text-muted-foreground">
            {lockedReason}
          </span>
        )}
      </span>
    </li>
  );
}

/** One module of the checklist: a section named by its h3, whose button opens and closes it. */
function ModuleGroup({
  group,
  value,
  ...rest
}: { readonly group: PermissionGroup; readonly value: ReadonlySet<string> } & Pick<
  PermissionChecklistProps,
  'onChange' | 'refused'
> & {
    readonly held: (key: string) => boolean;
    readonly lockedReason: string;
    readonly all: readonly string[];
  }) {
  const headingId = useId();
  const selected = group.keys.filter((key) => value.has(key)).length;
  return (
    <Collapsible
      defaultOpen
      render={<section aria-labelledby={headingId} />}
      className="border-t border-border pt-2"
    >
      <h3 id={headingId} className="text-sm font-semibold">
        <CollapsibleTrigger className="group flex min-h-11 w-full items-center justify-between gap-2 rounded-sm text-left">
          <span>{group.name}</span>
          <span className="flex items-center gap-2 font-normal text-muted-foreground">
            {selected} of {group.keys.length}
            <ChevronDown
              aria-hidden
              className="size-4 transition-transform group-data-[panel-open]:rotate-180 motion-reduce:transition-none"
            />
          </span>
        </CollapsibleTrigger>
      </h3>
      <CollapsibleContent>
        <ul className="flex flex-col">
          {group.keys.map((key) => (
            <PermissionRow
              key={key}
              permission={key}
              checked={value.has(key)}
              locked={!rest.held(key)}
              invalid={rest.refused?.includes(key) ?? false}
              lockedReason={rest.lockedReason}
              onCheckedChange={(checked) => {
                const next = new Set(value);
                if (checked) next.add(key);
                else next.delete(key);
                // Keep the catalog's order, and the permissions the checklist does not show.
                rest.onChange([
                  ...rest.all.filter((each) => next.has(each)),
                  ...[...next].filter((each) => !rest.all.includes(each)),
                ]);
              }}
            />
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** What the new role adds to and removes from the role it starts from (design core-304, RO13). */
function Difference({
  baseline,
  value,
}: {
  readonly baseline: NonNullable<PermissionChecklistProps['baseline']>;
  readonly value: readonly string[];
}) {
  const headingId = useId();
  const added = value.filter((key) => !baseline.permissions.includes(key));
  const removed = baseline.permissions.filter((key) => !value.includes(key));
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h3 id={headingId} className="text-sm font-semibold">
        Difference from {baseline.name}
      </h3>
      {added.length === 0 && removed.length === 0 ? (
        <p className="text-sm text-muted-foreground">The same permissions as {baseline.name}.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {added.map((key) => (
            <li key={key} className="flex flex-wrap items-center gap-2">
              <StatusBadge tone="success">Added</StatusBadge>
              {permissionLine(key)}
            </li>
          ))}
          {removed.map((key) => (
            <li key={key} className="flex flex-wrap items-center gap-2">
              <StatusBadge tone="destructive">Removed</StatusBadge>
              {permissionLine(key)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * The permission checklist of the role editor (design core-304, RO13 to RO20 and NO20): the
 * installed permissions grouped by module in the catalog's order, each in plain words with its
 * id, and the count of those ticked as a status ("6 of 36 selected."). Space ticks a permission
 * and focus stays on it; Enter on a module's button opens or closes the module. A permission the
 * editor does not hold at the plant is locked, because the API refuses to add it (ADR 0010).
 */
export function PermissionChecklist({
  value,
  onChange,
  baseline,
  refused,
}: PermissionChecklistProps) {
  const { plant } = useShell();
  const places = usePlaces();
  const viewer = useViewer();
  const { data, error } = useQuery(CorePermissionCatalog);
  const catalog = data?.corePermissionCatalog;
  if (catalog === undefined) {
    if (error !== undefined) {
      return (
        <p role="alert" className="text-sm text-destructive">
          Could not load the permissions. Check the connection, then reload the page.
        </p>
      );
    }
    return (
      <div aria-busy="true" className="flex flex-col gap-2">
        {['a', 'b', 'c', 'd'].map((key) => (
          <Skeleton key={key} aria-hidden className="h-4 w-64 motion-reduce:animate-none" />
        ))}
      </div>
    );
  }
  const groups = installedGroups(catalog);
  const all = groups.flatMap(({ keys }) => keys);
  const ticked = new Set(value);
  const count = all.filter((key) => ticked.has(key)).length;
  const plantName = places.plant?.name ?? plant;
  return (
    <div id={fieldId('permissions')} tabIndex={-1} className="flex flex-col gap-3">
      <p role="status" className="text-sm text-muted-foreground">
        {count} of {all.length} selected.
      </p>
      {groups.map((group) => (
        <ModuleGroup
          key={group.moduleId}
          group={group}
          value={ticked}
          all={all}
          onChange={onChange}
          refused={refused}
          held={(key) => viewer.can(key)}
          lockedReason={`You do not hold it at ${plantName}.`}
        />
      ))}
      {baseline !== undefined && <Difference baseline={baseline} value={value} />}
    </div>
  );
}
