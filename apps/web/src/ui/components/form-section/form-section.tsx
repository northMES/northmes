// SPDX-License-Identifier: AGPL-3.0-or-later
import { cn } from 'cn';
import { type ReactNode, useId } from 'react';

export interface FormSectionProps {
  /** The h2 that names the section, such as Identity. */
  readonly title: string;
  /** A line under the heading that says what the fields are for. */
  readonly description?: ReactNode;
  readonly className?: string;
  readonly children: ReactNode;
}

/**
 * A field group of a form page (design ui-222, Field group): a Card that is a section named by its
 * h2, with the fields under it.
 */
export function FormSection({ title, description, className, children }: FormSectionProps) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        'flex flex-col gap-4 rounded-xl border border-border bg-card p-6 text-card-foreground',
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="text-base font-semibold">
          {title}
        </h2>
        {description !== undefined && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}
