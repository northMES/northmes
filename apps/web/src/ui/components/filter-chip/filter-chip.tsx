// SPDX-License-Identifier: AGPL-3.0-or-later
import { X } from 'lucide-react';
import { IconButton } from '../icon-button/index.ts';

export interface FilterChipProps {
  /** The filter's name, such as "Article group". */
  readonly label: string;
  /** The picked values with how many rows have each. */
  readonly values: readonly { readonly label: string; readonly count: number }[];
  /** The remove button's name, such as "Remove the article group filter". */
  readonly removeLabel: string;
  readonly onRemove: () => void;
}

/**
 * A filter that applies, under a list's toolbar (design ui-222, LI3 and ST17): its name and the
 * picked values with their counts, such as "Article group: Hoses 21, Shafts 40", and a button
 * that removes the filter.
 */
export function FilterChip({ label, values, removeLabel, onRemove }: FilterChipProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted py-0.5 pr-0.5 pl-3 text-sm">
      <span>
        <span className="text-muted-foreground">{label}:</span>{' '}
        {values.map(({ label: value, count }, index) => (
          <span key={value}>
            {index > 0 && ', '}
            {value} <span className="font-mono text-xs">{count}</span>
          </span>
        ))}
      </span>
      <IconButton variant="ghost" size="icon-sm" label={removeLabel} onClick={onRemove}>
        <X aria-hidden />
      </IconButton>
    </span>
  );
}
