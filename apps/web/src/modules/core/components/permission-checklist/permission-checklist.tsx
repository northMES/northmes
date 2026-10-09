// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from '@apollo/client/react';
import { cn } from 'cn';
import { ChevronDown, Info, Lock } from 'lucide-react';
import { useId } from 'react';
import { StatusBadge } from '../../../../ui/components/status-badge/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { fieldId } from '../../../../ui/lib/field-id.ts';
import { Alert, AlertDescription } from '../../../../ui/primitives/alert.tsx';
import { Checkbox } from '../../../../ui/primitives/checkbox.tsx';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../../../../ui/primitives/collapsible.tsx';
import { Skeleton } from '../../../../ui/primitives/skeleton.tsx';
import { listOf } from '../../access-refusal.ts';
import { moduleName, permissionLine } from '../../permission-names.ts';
import { useCompanyId } from '../../use-places.ts';
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
  /** The role the rows' Added and Removed marks compare with: the one a new role starts from. */
  readonly baseline?: { readonly name: string; readonly permissions: readonly string[] };
  /** The save refused these permissions: each is marked invalid. */
  readonly refused?: readonly string[];
  /**
   * The permissions the edited role holds already. Ticking one of them again adds nothing, so it
   * is never locked.
   */
  readonly current?: readonly string[];
  /**
   * The edited role's name and the places where it is assigned, company first. A permission it
   * adds must be held by the editor at each of them (ADR 0010), so the others lock. A new role is
   * assigned nowhere and locks nothing.
   */
  readonly assigned?: {
    readonly roleName: string;
    readonly places: readonly { readonly id: string; readonly name: string }[];
  };
}

interface RowProps {
  readonly permission: string;
  readonly checked: boolean;
  /** The editor does not hold the permission: the row says so. */
  readonly unheld: boolean;
  /** The editor cannot tick it: the row draws a Lock in place of the checkbox. */
  readonly locked: boolean;
  readonly invalid: boolean;
  readonly lockedReason: string;
  /** Added or Removed against the role the form compares with; removed lines are struck through. */
  readonly mark?: 'added' | 'removed';
  readonly onCheckedChange: (checked: boolean) => void;
}

/**
 * One permission: a checkbox named by its plain line and described by its id. A permission the
 * editor does not hold at the company is described by why; when ticking it would add it, it is
 * locked: a Lock in place of the checkbox, aria-disabled and no Tab stop (design core-304, NO19).
 */
function PermissionRow({
  permission,
  checked,
  unheld,
  locked,
  invalid,
  lockedReason,
  mark,
  onCheckedChange,
}: RowProps) {
  const labelId = useId();
  const idId = useId();
  const reasonId = useId();
  const describedBy = unheld ? `${idId} ${reasonId}` : idId;
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
      <span className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-x-4 gap-y-0.5 text-sm">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span id={labelId} className={cn(mark === 'removed' && 'line-through')}>
            {permissionLine(permission)}
          </span>
          {unheld && (
            <span id={reasonId} className="text-xs text-muted-foreground">
              {lockedReason}
            </span>
          )}
        </span>
        <span className="flex items-center gap-2">
          <span id={idId} className="font-mono text-xs break-all text-muted-foreground">
            {permission}
          </span>
          {mark === 'added' && <StatusBadge tone="success">Added</StatusBadge>}
          {mark === 'removed' && <StatusBadge tone="destructive">Removed</StatusBadge>}
        </span>
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
    /** The first place where the role is assigned and the editor lacks the permission. */
    readonly lackingAt: (key: string) => string | undefined;
    /** Ticking the permission adds nothing: the role holds it already. */
    readonly current: ReadonlySet<string>;
    readonly all: readonly string[];
    /** The permissions of the role the form compares with, which the marks follow. */
    readonly baseline?: ReadonlySet<string>;
  }) {
  const headingId = useId();
  const selected = group.keys.filter((key) => value.has(key)).length;
  return (
    // A module with nothing ticked starts closed, its count on its button (RO13).
    <Collapsible
      defaultOpen={selected > 0}
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
          {group.keys.map((key) => {
            const lacking = rest.lackingAt(key);
            return (
              <PermissionRow
                key={key}
                permission={key}
                checked={value.has(key)}
                unheld={lacking !== undefined}
                // Removing a permission needs nothing; adding one needs it (ADR 0010).
                locked={lacking !== undefined && !value.has(key) && !rest.current.has(key)}
                invalid={rest.refused?.includes(key) ?? false}
                lockedReason={`You do not hold it at ${lacking ?? ''}.`}
                mark={markOf(key, value, rest.baseline)}
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
            );
          })}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Added or Removed for a permission against the role the form compares with, else none. */
function markOf(
  key: string,
  value: ReadonlySet<string>,
  baseline: ReadonlySet<string> | undefined,
): 'added' | 'removed' | undefined {
  if (baseline === undefined || value.has(key) === baseline.has(key)) return undefined;
  return value.has(key) ? 'added' : 'removed';
}

/** The count of the ticked permissions, such as "6 of 36 selected.". */
function selectedLine(count: number, total: number): string {
  return `${count} of ${total} selected.`;
}

/**
 * The permission checklist of the role editor (design core-304, RO13 to RO20 and NO20): the
 * installed permissions grouped by module in the catalog's order, each in plain words with its
 * id, and the count of those ticked ("6 of 36 selected."), which a tick says through announce(). Space ticks a permission
 * and focus stays on it; Enter on a module's button opens or closes the module. A permission the
 * editor does not hold at the company can be unticked but not ticked, because the grant rule asks
 * for it to add it and for nothing to remove it (ADR 0010). One the edited role holds already
 * can be ticked again.
 */
export function PermissionChecklist({
  value,
  onChange,
  baseline,
  refused,
  current = [],
  assigned,
}: PermissionChecklistProps) {
  const companyId = useCompanyId() ?? '';
  const viewer = useViewer();
  const { data, error } = useQuery(CorePermissionCatalog, { variables: { companyId } });
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
  // In company settings the viewer's permissions are those at the company, which grant at each
  // of its plants too (ADR 0066).
  const lackingAt = (key: string) => (viewer.can(key) ? undefined : assigned?.places[0]?.name);
  const currentKeys = new Set(current);
  const baselineKeys = baseline === undefined ? undefined : new Set(baseline.permissions);
  const anyLocked = all.some((key) => lackingAt(key) !== undefined && !currentKeys.has(key));
  // The count changes only through a tick, so the tick says the new count.
  const change = (next: string[]) => {
    onChange(next);
    const selected = new Set(next);
    announce(selectedLine(all.filter((key) => selected.has(key)).length, all.length));
  };
  return (
    <div id={fieldId('permissions')} tabIndex={-1} className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{selectedLine(count, all.length)}</p>
      {assigned !== undefined && anyLocked && (
        <Alert role="note" className="border-info bg-info-subtle text-foreground">
          <Info aria-hidden className="text-info" />
          <AlertDescription className="text-foreground">
            You can add a permission to {assigned.roleName} only when you hold it at{' '}
            {listOf(assigned.places.map(({ name }) => name))}, where {assigned.roleName} is
            assigned. The others show a lock.
          </AlertDescription>
        </Alert>
      )}
      {groups.map((group) => (
        <ModuleGroup
          key={group.moduleId}
          group={group}
          value={ticked}
          all={all}
          onChange={change}
          refused={refused}
          lackingAt={lackingAt}
          current={currentKeys}
          baseline={baselineKeys}
        />
      ))}
    </div>
  );
}
