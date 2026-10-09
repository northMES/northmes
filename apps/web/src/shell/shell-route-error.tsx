// SPDX-License-Identifier: AGPL-3.0-or-later
import { classifyError } from '@northmes/web-sdk';
import {
  type ErrorComponentProps,
  Link,
  useParams,
  useRouter,
  useRouterState,
} from '@tanstack/react-router';
import { CircleAlert, RotateCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ShellModule } from '../modules.ts';
import { PageFrame } from '../ui/components/page-frame/index.ts';
import { StatePanel, type StateRow } from '../ui/components/state-panel/index.ts';
import { Button, buttonVariants } from '../ui/primitives/button.tsx';
import { entryAt, wayOutOf } from './shell-pages.ts';

/** The first word of a route title in lower case, as ui-222 words a load failure: Could not load articles. */
function inSentence(title: string): string {
  return title.charAt(0).toLowerCase() + title.slice(1);
}

/** Moves focus to the h1 of the page that renders next, one frame after it renders. */
function focusNextHeading() {
  requestAnimationFrame(() => {
    document.querySelector<HTMLElement>('main h1[tabindex]')?.focus();
  });
}

/**
 * The shell's route error component, TanStack Router's default, so it replaces the failing route
 * inside its layout: the sidebar, the top bar and the crumbs stay, and the route's page actions
 * leave with it. A route that threw while it rendered gets D2's error panel (ST6): "{route title}
 * could not be shown", the correlation id, Stage render and Code web.render_error; Try again
 * renders the route again and focus moves to its h1. A data request that failed and reached the
 * route gets the server error page (shell-306 SE) in ui-222's wording, "Could not load {route
 * title}", with the correlation id and code the server sent. Both lead out to the first entry of
 * the module. The route title is the label of the page's navigation entry.
 */
export function ShellRouteError({
  modules,
  error,
  reset,
}: ErrorComponentProps & { readonly modules: readonly ShellModule[] }) {
  const router = useRouter();
  const place = useParams({ strict: false });
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  // The docs name no source for the correlation id of a render error, so the browser makes one.
  const [renderId] = useState(() => crypto.randomUUID());
  // The panel replaces a page that threw, also on the same path after a click, where the focused
  // control went with the page: its h1 takes focus one frame after it renders (D2 ST6). The first
  // load moves no focus, so the first Tab reaches the skip link.
  useEffect(() => {
    if (router.state.resolvedLocation === undefined) return;
    focusNextHeading();
  }, [router]);
  const routeTitle = entryAt(modules, place, pathname)?.label ?? 'This page';
  const wayOut = wayOutOf(modules, place, pathname);
  const failure = classifyError(error);
  const rendering = failure.page === 'render';
  const correlationId = rendering ? renderId : failure.correlationId;
  const rows: StateRow[] = [
    ...(correlationId === undefined
      ? []
      : [
          {
            label: 'Correlation id',
            value: correlationId,
            copyLabel: 'Copy correlation id',
            copiedMessage: 'Correlation id copied',
          },
        ]),
    ...(rendering ? [{ label: 'Stage', value: 'render' }] : []),
    ...(rendering
      ? [{ label: 'Code', value: 'web.render_error' }]
      : failure.code === undefined
        ? []
        : [{ label: 'Code', value: failure.code }]),
  ];
  return (
    <PageFrame
      title={
        rendering ? `${routeTitle} could not be shown` : `Could not load ${inSentence(routeTitle)}`
      }
      currentCrumb={routeTitle}
    >
      <StatePanel
        icon={CircleAlert}
        tone="destructive"
        lead={
          rendering
            ? 'This page stopped with an error while it was drawn. Saved data is not affected.'
            : 'The server stopped with an error while it loaded the data for this page. Saved data is not affected.'
        }
        detail={
          correlationId === undefined
            ? 'Try again.'
            : 'Try again. If the error comes back, give your plant admin the correlation id.'
        }
        rows={rows}
        actions={
          <>
            <Button
              onClick={() => {
                if (!rendering) void router.invalidate();
                reset();
                focusNextHeading();
              }}
            >
              <RotateCw aria-hidden />
              Try again
            </Button>
            {wayOut !== undefined && (
              <Link to={wayOut.href} className={buttonVariants({ variant: 'outline' })}>
                Go to {wayOut.label}
              </Link>
            )}
          </>
        }
      />
    </PageFrame>
  );
}
