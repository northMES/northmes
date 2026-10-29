// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cn } from 'cn';
import { type ReactNode, useId } from 'react';

export interface PageSectionProps {
  /** The id of the h2, when the page links to the section; left out, the section makes one. */
  readonly id?: string;
  /** The h2 that names the section, such as Tool. */
  readonly title: string;
  /** A line beside the heading that says what the section holds or where its content comes from. */
  readonly lead?: ReactNode;
  /** The section's actions at the end of the heading row, such as Edit operation. */
  readonly actions?: ReactNode;
  readonly className?: string;
  readonly children: ReactNode;
}

/**
 * A section of a record page (design ui-222, DE1): a Card that is a section named by its h2, with
 * the lead beside the heading, the actions at the end of the heading row, and its blocks 16 px
 * apart under the heading row. Stacked sections sit 16 px apart in the page frame's data region.
 */
export function PageSection({ id, title, lead, actions, className, children }: PageSectionProps) {
  const made = useId();
  const headingId = id ?? made;
  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        'flex flex-col gap-4 rounded-xl border border-border bg-card p-6 text-card-foreground',
        className,
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 id={headingId} className="text-base font-semibold">
            {title}
          </h2>
          {lead !== undefined && <p className="text-sm text-muted-foreground">{lead}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
