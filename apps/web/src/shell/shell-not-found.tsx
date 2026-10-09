// SPDX-License-Identifier: AGPL-3.0-or-later
import { companySettingsHref } from '@northmes/web-sdk';
import { Link, useParams, useRouterState } from '@tanstack/react-router';
import { SearchX } from 'lucide-react';
import type { ShellModule } from '../modules.ts';
import { PageFrame, usePageFrameTopBar } from '../ui/components/page-frame/index.ts';
import { StatePanel } from '../ui/components/state-panel/index.ts';
import { buttonVariants } from '../ui/primitives/button.tsx';
import { allPagesHref, mainId, plantHome, sidebarLinks } from './shell-pages.ts';

/** The h1 and the title part of every not-found page (shell-306, doc copy). */
const pageNotFound = 'Page not found';

/** Where Page not found leads: its name and href. */
interface WayOn {
  readonly label: string;
  readonly href: string;
}

/**
 * The module a path under a plant lies in, by its second segment, and the first entry of its
 * sidebar group, when the module is loaded and has one.
 */
function moduleAt(modules: readonly ShellModule[], plant: string, pathname: string) {
  const module = modules.find((each) => each.module.id === pathname.split('/')[2]);
  const [first] = module === undefined ? [] : sidebarLinks(module);
  return module === undefined || first === undefined
    ? undefined
    : { label: module.label, first: { label: first.label, href: first.link({ plant }).href } };
}

/**
 * The page of a path no route matches (design shell-306, NF1 to NF4), TanStack Router's default
 * not-found component, so it renders in the nearest layout. In a plant it renders inside the plant
 * layout with no current sidebar entry: "Plant A has no page at /plant-a/reports. The link may be
 * out of date.", Go to Plant A, the plant's first page, and See all pages. Under a loaded module it
 * is D2's module page not found (ST5): "Equipment has no page at /plant-a/equipment/gauges",
 * Go to the module's first entry, See all pages, and the module in the document title. In company
 * settings, which replaced the admin frame of NF3 (ADR 0066), it renders in the settings layout with
 * Go to Company settings, the landing that lists every settings page. The path shows in Plex Mono.
 * The shell moves focus to the h1 as on any path change.
 */
export function ShellNotFound({ modules }: { readonly modules: readonly ShellModule[] }) {
  const { plant, companyId } = useParams({ strict: false });
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const shellPlace = usePageFrameTopBar()?.titleContext ?? plant ?? 'NorthMES';
  const module = plant === undefined ? undefined : moduleAt(modules, plant, pathname);
  const place = module?.label ?? shellPlace;
  const home = plant === undefined ? undefined : plantHome(modules, plant);
  const wayOn: WayOn | undefined =
    companyId !== undefined
      ? { label: 'Go to Company settings', href: companySettingsHref(companyId) }
      : module !== undefined
        ? { label: `Go to ${module.first.label}`, href: module.first.href }
        : home !== undefined
          ? { label: `Go to ${place}`, href: home }
          : undefined;
  const page = (
    <PageFrame title={pageNotFound} titleSection={module?.label}>
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
