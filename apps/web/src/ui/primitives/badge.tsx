// SPDX-License-Identifier: AGPL-3.0-or-later
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from 'cn';

export interface BadgeProps {
  /** The lucide-react icon before the text, hidden from assistive technology. */
  readonly icon?: LucideIcon;
  /** The text, which carries the meaning on its own; the icon only repeats it. */
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * A status badge (design ui-222, Badge): an icon plus text on --muted, such as Archived with the
 * Archive icon. Color never carries the status alone.
 */
export function Badge({ icon: Icon, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 align-middle text-xs font-medium text-muted-foreground',
        className,
      )}
    >
      {Icon !== undefined && <Icon aria-hidden className="size-3.5 shrink-0" />}
      {children}
    </span>
  );
}
