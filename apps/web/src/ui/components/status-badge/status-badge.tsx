// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cn } from 'cn';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '../../primitives/badge.tsx';

/** The colour of a state: neutral, in progress (such as Planned), done or fine, or stopped. */
export type StatusTone = 'neutral' | 'info' | 'success' | 'destructive' | 'warning';

/**
 * The colours of each tone, read from data-tone, so the attribute a test reads is what draws them.
 * The D1 order status tokens --status-planned and its foreground equal the info pair.
 */
const tones =
  'data-[tone=neutral]:bg-muted data-[tone=neutral]:text-muted-foreground data-[tone=info]:bg-info-subtle data-[tone=info]:text-info data-[tone=success]:bg-success-subtle data-[tone=success]:text-success data-[tone=destructive]:bg-destructive-subtle data-[tone=destructive]:text-destructive data-[tone=warning]:bg-warning-subtle data-[tone=warning]:text-warning';

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
    <Badge data-tone={tone} className={cn('border-transparent', tones)}>
      {Icon !== undefined && <Icon aria-hidden />}
      {children}
    </Badge>
  );
}
