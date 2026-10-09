// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ApolloClient } from '@apollo/client';
import { ApolloProvider, useQuery } from '@apollo/client/react';
import { companySettingsHref } from '@northmes/web-sdk';
import { Link, Outlet, useParams, useRouterState } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ShellModule } from '../modules.ts';
import { NavIcon } from '../ui/components/nav-icon/index.ts';
import {
  PageFrame,
  PageFrameTopBar,
  type PageFrameTopBarValue,
  type PageState,
} from '../ui/components/page-frame/index.ts';
import { SkipLink } from '../ui/components/skip-link/index.ts';
import { isForbidden } from '../ui/lib/graphql-errors.ts';
import { applyStoredTheme } from '../ui/lib/theme.ts';
import { buttonVariants } from '../ui/primitives/button.tsx';
import { CoreCompanies } from './companies.graphql.ts';
import {
  companySettingsEntries,
  mainId,
  plantHome,
  plantOf,
  useFocusPageHeading,
} from './shell-pages.ts';
import {
  BackLink,
  type SettingsGroup,
  ShellSettingsLayout,
  ShellSettingsNav,
  settingsContentId,
  type WayLink,
} from './shell-settings-nav.tsx';
import { ShellTopBar } from './shell-top-bar.tsx';
import { ShellAccountMenu, type ShellUser } from './shell-user-menu.tsx';
import { CoreViewer } from './viewer.graphql.ts';

/** What the company landing reads from the layout around it. */
interface CompanySettingsState {
  /** The company's name, or undefined until the user's companies load. */
  readonly company: string | undefined;
  /** The entries of the company settings navigation, by group, once the permissions load. */
  readonly groups: readonly SettingsGroup[] | undefined;
  /** The way out of company settings, Back to the plant. */
  readonly back: WayLink;
  /**
   * Why the permissions did not load: forbidden when the company is not one of the user's (a stale
   * bookmark, a removed role, a mistyped id), failed on any other error.
   */
  readonly refused: 'forbidden' | 'failed' | undefined;
  /** Reads the user's companies and permissions again, after a failed read. */
  readonly retry: () => void;
}

const CompanySettingsContext = createContext<CompanySettingsState | null>(null);

interface CompanySettingsLayoutProps {
  readonly modules: readonly ShellModule[];
  /** The client without a plant, which company settings read and write through (ADR 0066). */
  readonly companiesClient: ApolloClient;
  readonly user: ShellUser;
  readonly onSignOut: () => void;
  /** The plant the user was at before, which Back to the plant leads to. */
  readonly lastPlant: string | undefined;
}

/**
 * The company settings layout at /settings/$companyId (design shell-313, C1, C5 and C6, ADR 0066):
 * a page without a plant and without the main sidebar. The top bar holds the trail "Settings >
 * Acme AB > Users", the page actions, the Settings button, which shows that the user is in
 * settings, and the account button. Main holds Back to the plant above the company settings
 * navigation, beside the page; below 768 px the page alone, with its way back above the h1. Its
 * requests carry no x-northmes-plant, so its pages read only core's plant-free fields, with the
 * company in companyId. Titles put the company's name where the plant goes. The skip link lands
 * after the settings navigation.
 */
export function CompanySettingsLayout({
  modules,
  companiesClient,
  user,
  onSignOut,
  lastPlant,
}: CompanySettingsLayoutProps) {
  const { companyId = '' } = useParams({ strict: false });
  const main = useFocusPageHeading();
  useEffect(applyStoredTheme, []);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { data, refetch: refetchCompanies } = useQuery(CoreCompanies, { client: companiesClient });
  const {
    data: viewer,
    error,
    refetch: refetchViewer,
  } = useQuery(CoreViewer, {
    client: companiesClient,
    variables: { companyId },
  });
  const refused: CompanySettingsState['refused'] =
    viewer !== undefined || error === undefined
      ? undefined
      : isForbidden(error)
        ? 'forbidden'
        : 'failed';
  const retry = useCallback(() => {
    refetchCompanies().catch(() => {});
    refetchViewer().catch(() => {});
  }, [refetchCompanies, refetchViewer]);
  const companies = data?.coreCompanies ?? [];
  const company = companies.find(({ id }) => id === companyId)?.name;
  const permissions = useMemo(
    () => (viewer === undefined ? undefined : new Set(viewer.coreViewer.companyPermissions)),
    [viewer],
  );
  const groups = useMemo(
    () =>
      viewer === undefined
        ? undefined
        : companySettingsEntries(modules, permissions, companyId)
            .map(({ moduleId, entries }) => ({
              label: moduleId === 'core' ? undefined : 'Modules',
              entries,
            }))
            .filter(({ entries }) => entries.length > 0),
    [viewer, modules, permissions, companyId],
  );
  const landing = companySettingsHref(companyId);
  const isLanding = pathname === landing || pathname === `${landing}/`;
  const from = lastPlant === undefined ? undefined : plantOf(companies, lastPlant);
  const back: WayLink =
    lastPlant !== undefined && from !== undefined
      ? { label: `Back to ${from.plant.name}`, href: plantHome(modules, lastPlant) ?? landing }
      : { label: 'Back to your plants', href: rootHref };
  const [breadcrumb, setBreadcrumb] = useState<HTMLElement | null>(null);
  const [actions, setActions] = useState<HTMLElement | null>(null);
  const name = company ?? 'Company';
  const topBar = useMemo<PageFrameTopBarValue>(
    () => ({
      trail: [{ label: 'Settings' }, ...(isLanding ? [] : [{ label: name, href: landing }])],
      titleContext: name,
      breadcrumb,
      actions,
    }),
    [isLanding, name, landing, breadcrumb, actions],
  );
  const state = useMemo(
    () => ({ company, groups, back, refused, retry }),
    [company, groups, back, refused, retry],
  );
  return (
    <ApolloProvider client={companiesClient}>
      <CompanySettingsContext.Provider value={state}>
        <SkipLink targetId={settingsContentId} />
        <div className="flex min-h-svh flex-col">
          <ShellTopBar
            breadcrumbRef={setBreadcrumb}
            actionsRef={setActions}
            settings={{ href: landing, current: true }}
            account={<ShellAccountMenu user={user} onSignOut={onSignOut} />}
          />
          <PageFrameTopBar value={topBar}>
            <main
              id={mainId}
              ref={main}
              tabIndex={-1}
              className="flex-1 px-4 py-6 md:px-7 focus-visible:outline-offset-[-4px]"
            >
              <ShellSettingsLayout
                column={
                  <>
                    <BackLink {...back} />
                    <ShellSettingsNav
                      company={company ?? ''}
                      title="Company settings"
                      groups={groups ?? []}
                      pathname={pathname}
                    />
                  </>
                }
                narrowBack={isLanding ? back : { label: 'Company settings', href: landing }}
              >
                <Outlet />
              </ShellSettingsLayout>
            </main>
          </PageFrameTopBar>
        </div>
      </CompanySettingsContext.Provider>
    </ApolloProvider>
  );
}

/** The href of /, where the user's plants are listed, for Back from a deep link into settings. */
const rootHref = '/';

/**
 * The landing's page state: the entries once the permissions load; for a company that is not one
 * of the user's, that it cannot be opened and the way back (shell-306's not found wording); after a
 * failed read, the error and Try again (ui-222's wording).
 */
function landingState(state: CompanySettingsState | null): PageState {
  if (state?.refused === 'forbidden') {
    return {
      status: 'empty',
      description:
        'These company settings do not exist, or you cannot open them. The link may be out of date.',
      action: (
        <Link to={state.back.href} className={buttonVariants({ variant: 'outline' })}>
          {state.back.label}
        </Link>
      ),
    };
  }
  if (state?.refused === 'failed') {
    return {
      status: 'error',
      title: 'Could not load company settings',
      description: 'Check the connection, then try again.',
      onRetry: state.retry,
    };
  }
  const groups = state?.groups;
  if (groups === undefined) return { status: 'loading' };
  if (groups.length === 0) {
    return {
      status: 'empty',
      description:
        'You hold no permission that opens a company settings page here. Ask a company admin for a role that includes one.',
    };
  }
  return { status: 'ready' };
}

/**
 * The company landing at /settings/$companyId (design shell-313, C5): the h1 Company settings and
 * the entries of the company settings navigation the user may open, each a row that leads to its
 * page. Its trail ends with the company, and its title reads "Company settings · Acme AB ·
 * NorthMES".
 */
export function CompanySettingsLanding() {
  const state = useContext(CompanySettingsContext);
  const groups = state?.groups;
  return (
    <PageFrame
      title="Company settings"
      currentCrumb={state?.company ?? 'Company'}
      state={landingState(state)}
    >
      <div className="flex max-w-xl flex-col gap-4">
        {(groups ?? []).map(({ label, entries }, index) => (
          <section key={label ?? 'entries'} className="flex flex-col gap-2">
            {label !== undefined && (
              <h2 id={`landing-group-${index}`} className="text-sm font-semibold">
                {label}
              </h2>
            )}
            <ul
              aria-label={label ?? 'Company settings entries'}
              className="divide-y overflow-hidden rounded-xl border bg-card"
            >
              {entries.map(({ label: entry, icon, href }) => (
                <li key={href}>
                  <Link
                    to={href}
                    className="flex min-h-12 items-center gap-3 px-4 text-sm hover:bg-accent"
                  >
                    <NavIcon name={icon} />
                    <span className="flex-1">{entry}</span>
                    <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </PageFrame>
  );
}
