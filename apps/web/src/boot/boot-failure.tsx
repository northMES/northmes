// SPDX-License-Identifier: AGPL-3.0-or-later
import { CircleAlert, RotateCw, WifiOff } from 'lucide-react';
import { useEffect } from 'react';
import { SkipLink } from '../ui/components/skip-link/index.ts';
import { StatePanel } from '../ui/components/state-panel/index.ts';
import { announce } from '../ui/lib/announce.ts';
import { Button } from '../ui/primitives/button.tsx';

/** Why the web could not start: the server sent an error, or nothing answered. */
export type BootFailureKind = 'error' | 'no-answer';

export interface BootFailureProps {
  readonly kind: BootFailureKind;
  /** Reloads the page, a fresh boot. */
  readonly onReload: () => void;
}

/** The id of main, which the skip link moves focus to. */
const mainId = 'main';

/**
 * NorthMES could not start (design shell-306, BO3 to BO7): the boot page's layout, with the mark in
 * the header and no Help or account menu, since nothing is known about the user. A card holds the
 * h1, what went wrong and Reload page. After a server error (BO3) it says to reload; after no
 * answer (BO6) it says the page tries again every 10 seconds. Nothing takes focus on this first
 * load, so the first Tab reaches the skip link; the polite region says "NorthMES could not start."
 * once.
 */
export function BootFailure({ kind, onReload }: BootFailureProps) {
  useEffect(() => {
    document.title = 'NorthMES could not start · NorthMES';
    announce('NorthMES could not start.');
  }, []);
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <SkipLink targetId={mainId} />
      <header className="flex h-14 items-center gap-2 border-b border-border px-4">
        <span
          aria-hidden
          className="grid size-6 place-items-center rounded-md bg-primary text-xs font-semibold text-primary-foreground"
        >
          N
        </span>
        <span className="font-semibold">NorthMES</span>
      </header>
      <main
        id={mainId}
        tabIndex={-1}
        className="flex flex-1 justify-center px-4 py-8 sm:py-24 focus-visible:outline-offset-[-4px]"
      >
        <div className="flex h-fit w-full max-w-150 flex-col gap-5 rounded-xl bg-card p-8 ring-1 ring-border max-sm:bg-transparent max-sm:p-0 max-sm:ring-0">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem] sm:leading-[2.125rem]">
            NorthMES could not start
          </h1>
          <StatePanel
            className="max-w-none bg-transparent p-0 ring-0"
            icon={kind === 'error' ? CircleAlert : WifiOff}
            tone={kind === 'error' ? 'destructive' : 'warning'}
            lead={
              kind === 'error'
                ? 'The server sent an error when this browser asked for its settings, so no page can open.'
                : 'NorthMES did not answer. It may be restarting, or this browser cannot reach the server.'
            }
            detail={
              kind === 'error'
                ? 'Reload to try again.'
                : 'This page tries again every 10 seconds and opens NorthMES when it answers.'
            }
            actions={
              // 44 px, the target of the pages a station can show (shell-306, E13).
              <Button className="h-(--nm-target-min-station) px-4" onClick={onReload}>
                <RotateCw aria-hidden />
                Reload page
              </Button>
            }
          />
        </div>
      </main>
    </div>
  );
}
