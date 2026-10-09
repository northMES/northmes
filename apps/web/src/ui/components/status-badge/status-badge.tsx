// SPDX-License-Identifier: AGPL-3.0-or-later
import { cn } from 'cn';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '../../primitives/badge.tsx';

/** The colour of a state: neutral, in progress (such as Planned), done or fine, or stopped. */
export type StatusTone = 'neutral' | 'info' | 'success' | 'destructive';

const tones: Readonly<Record<StatusTone, string>> = {
  neutral: 'bg-muted text-muted-foreground',
  // The D1 order status tokens --status-planned and its foreground equal these two.
  info: 'bg-info-subtle text-info',
  success: 'bg-success-subtle text-success',
  destructive: 'bg-destructive-subtle text-destructive',
};

export interface StatusBadgeProps {
  readonly tone: StatusTone;
  /** The icon before the text, hidden from screen readers. */
  readonly icon?: LucideIcon;
  /** The state in words, which always carries it (WCAG 1.4.1). */
  readonly children: ReactNode;
}

/**
 * StatusBadge (design ui-222 and core-304, Badge): an icon and the state in words on a tone's
 * subtle colour, such as Archived, Active or Blocked.
 */
export function StatusBadge({ tone, icon: Icon, children }: StatusBadgeProps) {
  return (
    <Badge data-tone={tone} className={cn('border-transparent', tones[tone])}>
      {Icon !== undefined && <Icon aria-hidden />}
      {children}
    </Badge>
  );
}
