// SPDX-License-Identifier: AGPL-3.0-or-later
import { companySettingsHref } from '@northmes/web-sdk';
import { Link, useParams, useRouterState } from '@tanstack/react-router';
import { SearchX } from 'lucide-react';
import type { ShellModule } from '../modules.ts';
import { PageFrame, usePageFrameTopBar } from '../ui/components/page-frame/index.ts';
import { StatePanel } from '../ui/components/state-panel/index.ts';
import { buttonVariants } from '../ui/primitives/button.tsx';
import { allPagesHref, mainId, plantHome } from './shell-pages.ts';

/** The h1 and the title part of every not-found page (shell-306, doc copy). */
const pageNotFound = 'Page not found';

/** Where Page not found leads: its name and href. */
interface WayOn {
  readonly label: string;
  readonly href: string;
}

/**
 * The page of a path no route matches (design shell-306, NF1 to NF4), TanStack Router's default
 * not-found component, so it renders in the nearest layout. In a plant it renders inside the plant
 * layout with no current sidebar entry: "Plant A has no page at /plant-a/reports. The link may be
 * out of date.", Go to Plant A, the plant's first page, and See all pages. In company settings, which replaced the
 * admin frame of NF3 (ADR 0066), it renders in the settings layout with Go to Company settings,
 * the landing that lists every settings page. The path shows in Plex Mono. The shell moves focus to
 * the h1 as on any path change.
 */
export function ShellNotFound({ modules }: { readonly modules: readonly ShellModule[] }) {
  const { plant, companyId } = useParams({ strict: false });
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const place = usePageFrameTopBar()?.titleContext ?? plant ?? 'NorthMES';
  const home = plant === undefined ? undefined : plantHome(modules, plant);
  const wayOn: WayOn | undefined =
    companyId !== undefined
      ? { label: 'Go to Company settings', href: companySettingsHref(companyId) }
      : home !== undefined
        ? { label: `Go to ${place}`, href: home }
        : undefined;
  const page = (
    <PageFrame title={pageNotFound}>
      <StatePanel
        icon={SearchX}
        tone="muted"
        lead={
          <>
            {place} has no page at <code className="font-mono text-sm">{pathname}</code>. The link
            may be out of date.
          </>
        }
        actions={
          wayOn === undefined ? undefined : (
            <>
              <Link to={wayOn.href} className={buttonVariants()}>
                {wayOn.label}
              </Link>
              {plant !== undefined && (
                <Link to={allPagesHref(plant)} className={buttonVariants({ variant: 'outline' })}>
                  See all pages
                </Link>
              )}
            </>
          )
        }
      />
    </PageFrame>
  );
  // Outside a plant and company settings no layout holds main, so the page brings its own.
  if (plant !== undefined || companyId !== undefined) return page;
  return (
    <main id={mainId} tabIndex={-1} className="px-4 py-6 md:px-7">
      {page}
    </main>
  );
}
