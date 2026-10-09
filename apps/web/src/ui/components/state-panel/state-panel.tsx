// SPDX-License-Identifier: AGPL-3.0-or-later
import { cn } from 'cn';
import { Copy, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { announce } from '../../lib/announce.ts';
import { Card } from '../../primitives/card.tsx';
import { IconButton } from '../icon-button/index.ts';

/** One row of the panel's description list, such as the correlation id or the code. */
export interface StateRow {
  readonly label: string;
  /** Shown in Plex Mono; a long id wraps. */
  readonly value: string;
  /** The name of the button that copies the value, such as Copy correlation id. */
  readonly copyLabel?: string;
  /** What the polite region says once the value is copied, such as Correlation id copied. */
  readonly copiedMessage?: string;
}

export interface StatePanelProps {
  /** The lucide icon beside the lead, decorative. */
  readonly icon: LucideIcon;
  /** destructive for an error, warning for no answer, muted for not found (shell-306, Icons). */
  readonly tone: 'destructive' | 'warning' | 'muted';
  /** What happened, beside the icon. */
  readonly lead: ReactNode;
  /** What to do next, under the lead. */
  readonly detail?: ReactNode;
  readonly rows?: readonly StateRow[];
  /** The buttons and links: a way on, a retry, a way out. */
  readonly actions?: ReactNode;
  readonly className?: string;
}

const toneClass = {
  destructive: 'text-destructive',
  warning: 'text-warning',
  muted: 'text-muted-foreground',
} as const;

/** Copies a row's value; focus stays on the button, and the polite region says so once. */
async function copy(value: string, copiedMessage: string) {
  try {
    await navigator.clipboard.writeText(value);
    announce(copiedMessage);
  } catch {
    // The browser refuses without focus, without permission or on an insecure origin.
    announce('Could not copy the correlation id. Select it and copy it by hand.');
  }
}

/**
 * The state panel of the error and not-found pages (design shell-306, Tokens; D2 ST6): a Card at
 * most 640 px wide with the icon and the lead, the detail, a description list with a top border
 * whose values are in Plex Mono and whose label sits above the value at 320, and the actions, which
 * wrap with 8 px gaps and stack at 320. A row with a copy label gets an IconButton beside its value
 * that never shrinks. The panel has no role: the page's h1 names what happened.
 */
export function StatePanel({
  icon: Icon,
  tone,
  lead,
  detail,
  rows = [],
  actions,
  className,
}: StatePanelProps) {
  return (
    <Card className={cn('grid max-w-160 gap-4 px-6 py-6 ring-border', className)}>
      <div className="flex items-start gap-3">
        <Icon aria-hidden className={cn('mt-0.5 size-6 shrink-0', toneClass[tone])} />
        <p className="max-w-[72ch] text-base leading-6 font-medium">{lead}</p>
      </div>
      {detail !== undefined && <p className="max-w-[72ch]">{detail}</p>}
      {rows.length > 0 && (
        <dl className="border-t">
          {rows.map(({ label, value, copyLabel, copiedMessage }) => (
            <div
              key={label}
              className="grid min-h-10 items-center gap-1 border-b py-1.5 sm:grid-cols-[140px_1fr] sm:gap-0"
            >
              <dt className="text-xs leading-4 font-semibold text-muted-foreground">{label}</dt>
              <dd className="flex items-center gap-2 font-mono text-[13px] leading-[18px] font-medium">
                <span className="min-w-0 [overflow-wrap:anywhere]">{value}</span>
                {copyLabel !== undefined && (
                  <IconButton
                    label={copyLabel}
                    variant="ghost"
                    className="shrink-0"
                    onClick={() => copy(value, copiedMessage ?? `${label} copied`)}
                  >
                    <Copy />
                  </IconButton>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {actions !== undefined && (
        <div className="flex flex-wrap gap-2 max-sm:flex-col max-sm:*:w-full">{actions}</div>
      )}
    </Card>
  );
}
