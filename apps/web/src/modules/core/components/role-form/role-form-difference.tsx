// SPDX-License-Identifier: AGPL-3.0-or-later
import { useId } from 'react';
import { FormSection } from '../../../../ui/components/form-section/index.ts';
import { permissionCount } from '../../access-refusal.ts';
import { permissionLine } from '../../permission-names.ts';

/** One column of the difference: Added (1) or Removed (2), each permission's line and id. */
function Column({ title, keys }: { readonly title: string; readonly keys: readonly string[] }) {
  const headingId = useId();
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <h3 id={headingId} className="text-sm font-semibold">
        {title}
      </h3>
      {keys.length > 0 && (
        <ul aria-labelledby={headingId} className="flex flex-col gap-2">
          {keys.map((key) => (
            <li
              key={key}
              className="flex flex-col gap-0.5 rounded-lg border border-border px-3 py-2 text-sm"
            >
              <span>{permissionLine(key)}</span>
              <span className="font-mono text-xs break-all text-muted-foreground">{key}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Difference from Planner (design core-304, RO13): a card above Permissions with the summary
 * "Night planner holds 7 permissions: Planner's 8, with 1 added and 2 removed.", then the
 * permissions added and those removed, each with its line and id.
 */
export function RoleFormDifference({
  name,
  baseline,
  value,
}: {
  /** The typed role name; "The new role" until one is typed. */
  readonly name: string;
  readonly baseline: { readonly name: string; readonly permissions: readonly string[] };
  readonly value: readonly string[];
}) {
  const added = value.filter((key) => !baseline.permissions.includes(key));
  const removed = baseline.permissions.filter((key) => !value.includes(key));
  const role = name.trim() === '' ? 'The new role' : name.trim();
  return (
    <FormSection
      title={`Difference from ${baseline.name}`}
      description={`${role} holds ${permissionCount(value.length)}: ${baseline.name}'s ${baseline.permissions.length}, with ${added.length} added and ${removed.length} removed.`}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Column title={`Added (${added.length})`} keys={added} />
        <Column title={`Removed (${removed.length})`} keys={removed} />
      </div>
    </FormSection>
  );
}
