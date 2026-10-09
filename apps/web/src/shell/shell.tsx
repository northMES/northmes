// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ApolloClient } from '@apollo/client';
import { ApolloProvider, useQuery } from '@apollo/client/react';
import { createNorthmesClient, createShellRoutes, ShellProvider } from '@northmes/web-sdk';
import {
  createRoute,
  createRouter,
  Link,
  Outlet,
  type RouterHistory,
  redirect,
  useParams,
  useRouter,
  useRouterState,
  useSearch,
} from '@tanstack/react-router';
import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import type { AuthSession } from '../auth/auth-session.ts';
import { returnPathOf, signInPath, signInSearch } from '../auth/sign-in-link.ts';
import { SignInScreen } from '../auth/sign-in-screen/index.ts';
import type { ShellModule } from '../modules.ts';
import {
  type Crumb,
  PageFrameTopBar,
  type PageFrameTopBarValue,
} from '../ui/components/page-frame/index.ts';
import { SkipLink } from '../ui/components/skip-link/index.ts';
import { applyStoredTheme } from '../ui/lib/theme.ts';
import { SidebarInset, SidebarProvider } from '../ui/primitives/sidebar.tsx';
import { CoreCompanies, type ShellCompany } from './companies.graphql.ts';
import { ShellSidebar } from './shell-sidebar.tsx';
import { ShellTopBar } from './shell-top-bar.tsx';
import type { ShellUser } from './shell-user-menu.tsx';

export interface ShellRouterOptions {
  /** The viewer's session: the plant routes need one, and every API request carries its JWT. */
  readonly session: AuthSession;
  /** The URL of the API, from config.json. Without one, the API is on the page's origin. */
  readonly apiUrl?: string;
  /** Replaces the browser history, for tests. */
  readonly history?: RouterHistory;
  /** Replaces the global fetch of each plant's Apollo client, for tests. */
  readonly fetch?: typeof globalThis.fetch;
}

/**
 * Creates the web's router, once at boot: each module's routes under /$plant, and the sign-in
 * page at /sign-in. The $plant route renders the D2 shell, and ShellProvider and the Apollo client
 * of the plant in the URL around the screen. A viewer without a session who opens a plant page
 * goes to sign-in with the page as the return path, and so does one whose request the API
 * refuses with 401.
 */
export function createShellRouter(
  modules: readonly ShellModule[],
  { session, apiUrl, history, fetch }: ShellRouterOptions,
) {
  // One client per plant for the router's life (ADR 0018). Switching plants and disposing the
  // client of the plant left behind come with the plant switcher.
  const clients = new Map<string, ApolloClient>();
  const clearCaches = () => Promise.all([...clients.values()].map((client) => client.clearStore()));
  const toSignIn = async (search: { redirect?: string; signedOut?: true }) => {
    await router.navigate({ to: signInPath, search });
    await clearCaches();
  };
  const auth = {
    token: () => session.token(),
    onUnauthenticated: () => {
      // The first refused request ends the session; the requests refused with it follow it.
      if (session.user() === undefined) return;
      session.forget();
      void toSignIn({ redirect: router.state.location.href });
    },
  };
  // The user's companies and plants are the same at every plant, so one client without a plant
  // reads them, and its cache serves every plant switch.
  const companiesClient = createNorthmesClient({ apiUrl, fetch, auth });
  clients.set('', companiesClient);
  const clientFor = (plant: string): ApolloClient => {
    const client = clients.get(plant) ?? createNorthmesClient({ plant, apiUrl, fetch, auth });
    clients.set(plant, client);
    return client;
  };
  const signOut = async () => {
    await session.signOut();
    await toSignIn({ signedOut: true });
  };
  const ordered = [...modules].sort((a, b) => a.order - b.order);
  const routeTree = createShellRoutes({
    modules: modules.map(({ module }) => module),
    plantComponent: () => (
      <PlantLayout
        modules={ordered}
        clientFor={clientFor}
        companiesClient={companiesClient}
        session={session}
        onSignOut={signOut}
      />
    ),
    plantBeforeLoad: ({ location }) => {
      if (session.user() === undefined) {
        throw redirect({ to: signInPath, search: { redirect: location.href } });
      }
    },
    outsidePlantRoutes: (rootRoute) => [
      createRoute({
        getParentRoute: () => rootRoute,
        path: signInPath,
        validateSearch: signInSearch,
        component: () => <SignInPage session={session} />,
      }),
    ],
  });
  const router = createRouter({ routeTree, history });
  return router;
}

/** The sign-in route's component: the sign-in page, which leads to the return path once signed in. */
function SignInPage({ session }: { readonly session: AuthSession }) {
  const search = signInSearch(useSearch({ strict: false }));
  const router = useRouter();
  return (
    <SignInScreen
      session={session}
      signedOut={search.signedOut === true}
      onSignedIn={() => void router.navigate({ href: returnPathOf(search) })}
    />
  );
}

/** The id of main, which the skip link moves focus to. */
const mainId = 'main';

/** The id of the sidebar, which the sidebar trigger controls. */
const sidebarId = 'shell-sidebar';

/** The user menu's user while the session has none, which the plant routes' guard prevents. */
const nobody: ShellUser = { name: 'Not signed in', username: '' };

/**
 * Moves focus to the page's h1 after each path change, one frame after the new route rendered, and
 * to main when the page has no h1 that takes focus (ADR 0021). The first load moves no focus, so
 * the first Tab reaches the skip link (D2, Focus rules). A change of the search alone leaves focus
 * where it is, so sorting, searching and paging keep focus on their control.
 */
function useFocusPageHeading() {
  const main = useRef<HTMLElement>(null);
  const shownPath = useRef<string | undefined>(undefined);
  const pathname = useRouterState({ select: (state) => state.resolvedLocation?.pathname });
  useEffect(() => {
    if (pathname === undefined) return;
    const left = shownPath.current;
    shownPath.current = pathname;
    if (left === undefined || left === pathname) return;
    const frame = requestAnimationFrame(() => {
      // An h1 without a tabindex, such as the board stub's, cannot take focus, so main does.
      const heading = main.current?.querySelector<HTMLElement>('h1[tabindex]');
      (heading ?? main.current)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);
  return main;
}

/** The href of the first sidebar entry of a module, at a plant. */
function firstHref(module: ShellModule | undefined, plant: string): string | undefined {
  return module?.links?.[0]?.link({ plant }).href;
}

/** The href of a plant's first page, the first entry of the sidebar, until a plant has a home page. */
function plantHome(modules: readonly ShellModule[], plant: string): string | undefined {
  return firstHref(
    modules.find(({ links = [] }) => links.length > 0),
    plant,
  );
}

/** The company and the plant of the user's companies that a slug names. */
function plantOf(companies: readonly ShellCompany[], slug: string) {
  for (const company of companies) {
    const plant = company.plants.find((each) => each.slug === slug);
    if (plant !== undefined) return { company, plant };
  }
  return undefined;
}

/**
 * The crumbs the shell puts before a page's own (ADR 0067): the company, as text, when the user's
 * plants span two or more companies; the plant by its name, or its slug until the plants load,
 * linked to the plant's first page; then the module of the page, linked to its first entry. A
 * crumb whose page is the one on screen is plain text.
 */
function shellTrail(
  modules: readonly ShellModule[],
  plant: string,
  companies: readonly ShellCompany[],
  pathname: string,
): readonly Crumb[] {
  const crumb = (label: string, href: string | undefined): Crumb =>
    href === undefined || href === pathname ? { label } : { label, href };
  const moduleId = pathname.split('/')[2];
  const current = modules.find(({ module }) => module.id === moduleId);
  const found = plantOf(companies, plant);
  const spansCompanies = companies.filter(({ plants }) => plants.length > 0).length > 1;
  return [
    ...(found !== undefined && spansCompanies ? [{ label: found.company.name }] : []),
    crumb(found?.plant.name ?? plant, plantHome(modules, plant)),
    ...(current === undefined ? [] : [crumb(current.label, firstHref(current, plant))]),
  ];
}

interface PlantLayoutProps {
  readonly modules: readonly ShellModule[];
  readonly clientFor: (plant: string) => ApolloClient;
  /** The client without a plant, which reads the user's companies and plants. */
  readonly companiesClient: ApolloClient;
  readonly session: AuthSession;
  readonly onSignOut: () => void;
}

/**
 * The $plant route's component, the D2 planner shell: the skip link, the sidebar, the top bar with
 * the breadcrumb and the page actions, and main with the route, inside the shell state and Apollo
 * client of the plant. The DOM order is the focus order: skip link, sidebar, top bar, main. Once
 * the user's plants have loaded, a slug that names none of them gets the page of an unknown plant
 * (ADR 0007, D2 ST29) instead of the shell; while they load, or when they fail to, the shell shows
 * the slug.
 */
function PlantLayout({
  modules,
  clientFor,
  companiesClient,
  session,
  onSignOut,
}: PlantLayoutProps) {
  const { plant } = useParams({ strict: false });
  const main = useFocusPageHeading();
  useEffect(applyStoredTheme, []);
  const { data } = useQuery(CoreCompanies, { client: companiesClient });
  const loaded = data?.coreCompanies;
  const companies = loaded ?? [];
  const found = plantOf(companies, plant);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [breadcrumb, setBreadcrumb] = useState<HTMLElement | null>(null);
  const [actions, setActions] = useState<HTMLElement | null>(null);
  const topBar = useMemo<PageFrameTopBarValue>(
    () => ({
      trail: shellTrail(modules, plant, companies, pathname),
      titleContext: found?.plant.name ?? plant,
      breadcrumb,
      actions,
    }),
    [modules, plant, companies, found, pathname, breadcrumb, actions],
  );
  if (loaded !== undefined && found === undefined) {
    return <UnknownPlant modules={modules} plant={plant} companies={companies} main={main} />;
  }
  return (
    <ApolloProvider client={clientFor(plant)}>
      <ShellProvider value={{ plant }}>
        <SkipLink targetId={mainId} />
        <SidebarProvider>
          <ShellSidebar
            id={sidebarId}
            modules={modules}
            plant={plant}
            companies={companies}
            user={session.user() ?? nobody}
            onSignOut={onSignOut}
          />
          <SidebarInset className="min-w-0">
            <ShellTopBar
              sidebarId={sidebarId}
              breadcrumbRef={setBreadcrumb}
              actionsRef={setActions}
            />
            <PageFrameTopBar value={topBar}>
              <main
                id={mainId}
                ref={main}
                tabIndex={-1}
                className="flex-1 px-4 py-6 md:px-7 focus-visible:outline-offset-[-4px]"
              >
                <Outlet />
              </main>
            </PageFrameTopBar>
          </SidebarInset>
        </SidebarProvider>
      </ShellProvider>
    </ApolloProvider>
  );
}

interface UnknownPlantProps {
  readonly modules: readonly ShellModule[];
  readonly plant: string;
  readonly companies: readonly ShellCompany[];
  readonly main: RefObject<HTMLElement | null>;
}

/**
 * The page of a plant slug that names none of the user's plants (D2 ST29): no sidebar and no
 * crumbs, the h1 Plant not found, and links to the first page of each of the user's plants, under
 * their company's name when they span two or more companies. It never says whether the plant
 * exists.
 */
function UnknownPlant({ modules, plant, companies, main }: UnknownPlantProps) {
  const withPlants = companies.filter(({ plants }) => plants.length > 0);
  const title = 'Plant not found';
  useEffect(() => {
    document.title = `${title} · NorthMES`;
  }, []);
  const links = (company: ShellCompany) => (
    <ul className="grid gap-1">
      {company.plants.map((each) => (
        <li key={each.slug}>
          <Link to={plantHome(modules, each.slug) ?? '.'} className="text-link underline">
            {each.name}
          </Link>
        </li>
      ))}
    </ul>
  );
  return (
    <main
      id={mainId}
      ref={main}
      tabIndex={-1}
      className="mx-auto grid max-w-xl gap-4 px-4 py-10 focus-visible:outline-offset-[-4px]"
    >
      <h1 tabIndex={-1} className="text-2xl font-semibold">
        {title}
      </h1>
      <p>
        {plant} is not a plant you can open.{' '}
        {withPlants.length > 0 ? 'Choose one of your plants.' : 'You have no plant to open yet.'}
      </p>
      {withPlants.length > 1
        ? withPlants.map((company) => (
            <section
              key={company.id}
              aria-labelledby={`company-${company.id}`}
              className="grid gap-2"
            >
              <h2 id={`company-${company.id}`} className="text-lg font-medium">
                {company.name}
              </h2>
              {links(company)}
            </section>
          ))
        : withPlants.map((company) => <div key={company.id}>{links(company)}</div>)}
    </main>
  );
}
