// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ApolloClient } from '@apollo/client';
import { ApolloProvider, useQuery } from '@apollo/client/react';
import {
  companySettingsHref,
  createNorthmesClient,
  createShellRoutes,
  ShellProvider,
} from '@northmes/web-sdk';
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
import { type RefObject, useEffect, useMemo, useState } from 'react';
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
import { CompanySettingsLanding, CompanySettingsLayout } from './shell-company-settings.tsx';
import {
  companySettingsEntries,
  currentOf,
  firstHref,
  mainId,
  plantHome,
  plantOf,
  plantSettingsLinks,
  settingsGroupsOf,
  shownTo,
  sidebarId,
  sidebarLinks,
  useFocusPageHeading,
} from './shell-pages.ts';
import {
  type SettingsGroup,
  ShellSettingsLayout,
  ShellSettingsNav,
  settingsContentId,
} from './shell-settings-nav.tsx';
import { ShellSidebar } from './shell-sidebar.tsx';
import { type SettingsButtonTarget, ShellTopBar } from './shell-top-bar.tsx';
import type { ShellUser } from './shell-user-menu.tsx';
import { CoreViewer } from './viewer.graphql.ts';

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

/** The user menu's user while the session has none, which the plant routes' guard prevents. */
const nobody: ShellUser = { name: 'Not signed in', username: '' };

/**
 * Creates the web's router, once at boot: each module's routes under /$plant, company settings at
 * /settings/$companyId with each module's settingsRoutes (ADR 0066), and the sign-in page at
 * /sign-in. The $plant route renders the D2 shell, and ShellProvider and the Apollo client of the
 * plant in the URL around the screen; company settings render their own layout without a plant,
 * with the client that names no plant. A viewer without a session who opens a plant or settings
 * page goes to sign-in with the page as the return path, and so does one whose request the API
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
  // reads them, and its cache serves every plant switch. Company settings, which have no plant,
  // read and write through it too (ADR 0066).
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
  // The plant the user was at last, where company settings lead back to (ADR 0066).
  let lastPlant: string | undefined;
  // The user's own choice of the main sidebar, kept while company settings replace the plant's
  // layout, so leaving them returns it (ADR 0066).
  const sidebarChoice: SidebarChoice = { open: true };
  const ordered = [...modules].sort((a, b) => a.order - b.order);
  const signedIn = ({ location }: { readonly location: { readonly href: string } }) => {
    if (session.user() === undefined) {
      throw redirect({ to: signInPath, search: { redirect: location.href } });
    }
  };
  const routeTree = createShellRoutes({
    modules: modules.map(({ module }) => module),
    plantComponent: () => (
      <PlantLayout
        modules={ordered}
        clientFor={clientFor}
        companiesClient={companiesClient}
        session={session}
        onSignOut={signOut}
        onPlant={(plant) => {
          lastPlant = plant;
        }}
        sidebarChoice={sidebarChoice}
      />
    ),
    plantBeforeLoad: signedIn,
    settingsComponent: () => (
      <CompanySettingsLayout
        modules={ordered}
        companiesClient={companiesClient}
        user={session.user() ?? nobody}
        onSignOut={signOut}
        lastPlant={lastPlant}
      />
    ),
    settingsIndexComponent: CompanySettingsLanding,
    settingsBeforeLoad: signedIn,
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

/**
 * The plant's first page the user may open: the first entry of the main sidebar that shows, the
 * modules by their order. An entry that needs a permission counts only once the permissions say the
 * user holds it.
 */
function firstOpenPage(
  modules: readonly ShellModule[],
  plant: string,
  permissions: ReadonlySet<string> | undefined,
): { label: string; href: string } | undefined {
  const entry = modules.flatMap(sidebarLinks).find(shownTo(permissions));
  return entry === undefined ? undefined : { label: entry.label, href: entry.link({ plant }).href };
}

/**
 * The crumbs the shell puts before a page's own (ADR 0067): the company, as text, when the user's
 * plants span two or more companies; the plant by its name, or its slug until the plants load,
 * linked to the plant's first page; then the module of the page, linked to its first entry, or on
 * a plant settings page the Settings crumb, linked to the first plant settings entry (ADR 0066). A
 * crumb whose page is the one on screen is plain text.
 */
function shellTrail(
  modules: readonly ShellModule[],
  plant: string,
  companies: readonly ShellCompany[],
  pathname: string,
  settingsHome: string | undefined,
): readonly Crumb[] {
  const crumb = (label: string, href: string | undefined): Crumb =>
    href === undefined || href === pathname ? { label } : { label, href };
  const found = plantOf(companies, plant);
  const spansCompanies = companies.filter(({ plants }) => plants.length > 0).length > 1;
  const head = [
    ...(found !== undefined && spansCompanies ? [{ label: found.company.name }] : []),
    crumb(found?.plant.name ?? plant, plantHome(modules, plant)),
  ];
  if (settingsHome !== undefined) return [...head, crumb('Settings', settingsHome)];
  const moduleId = pathname.split('/')[2];
  const current = modules.find(({ module }) => module.id === moduleId);
  return [
    ...head,
    ...(current === undefined ? [] : [crumb(current.label, firstHref(current, plant))]),
  ];
}

/** The user's own choice of the main sidebar, open or the rail, for the router's life. */
interface SidebarChoice {
  open: boolean;
}

/**
 * The open state of the main sidebar (ADR 0066): the user's own choice, except on a settings page,
 * where it collapses to the rail on its own. Leaving settings, plant or company, returns it to the
 * user's choice, which the router keeps; an expand on a settings page lasts until the user leaves
 * settings. The collapse moves no focus.
 */
function useSidebarOpen(inSettings: boolean, choice: SidebarChoice) {
  const [own, setOwnState] = useState(choice.open);
  const setOwn = (next: boolean) => {
    choice.open = next;
    setOwnState(next);
  };
  const [visit, setVisit] = useState({ inSettings, open: false });
  // Entering or leaving settings starts a new visit, collapsed.
  if (visit.inSettings !== inSettings) setVisit({ inSettings, open: false });
  const open = inSettings ? visit.inSettings === inSettings && visit.open : own;
  const onOpenChange = (next: boolean) => {
    if (inSettings) setVisit({ inSettings, open: next });
    else setOwn(next);
  };
  return { open, onOpenChange };
}

interface PlantLayoutProps {
  readonly modules: readonly ShellModule[];
  readonly clientFor: (plant: string) => ApolloClient;
  /** The client without a plant, which reads the user's companies and plants. */
  readonly companiesClient: ApolloClient;
  readonly session: AuthSession;
  readonly onSignOut: () => void;
  /** Hears the plant the user is at, which company settings lead back to. */
  readonly onPlant: (plant: string) => void;
  /** The user's own choice of the main sidebar, which outlives a visit to company settings. */
  readonly sidebarChoice: SidebarChoice;
}

/**
 * The $plant route's component, the D2 planner shell: the skip link, the sidebar, the top bar with
 * the breadcrumb, the page actions and the Settings button, and main with the route, inside the
 * shell state and Apollo client of the plant. The DOM order is the focus order: skip link, sidebar,
 * top bar, main. A route whose entry is in the plant settings navigation gets the settings layout
 * inside main, the sidebar collapsed to the rail and the Settings crumb (ADR 0066). Once the user's
 * plants have loaded, a slug that names none of them gets the page of an unknown plant (ADR 0007,
 * D2 ST29) instead of the shell; while they load, or when they fail to, the shell shows the slug.
 */
function PlantLayout({
  modules,
  clientFor,
  companiesClient,
  session,
  onSignOut,
  onPlant,
  sidebarChoice,
}: PlantLayoutProps) {
  const { plant } = useParams({ strict: false });
  const main = useFocusPageHeading();
  useEffect(applyStoredTheme, []);
  useEffect(() => onPlant(plant), [onPlant, plant]);
  const { data } = useQuery(CoreCompanies, { client: companiesClient });
  // The permissions at the plant and its company, read only when an entry needs one.
  const gated = modules.some(
    ({ links = [], settingsLinks = [] }) =>
      links.some(({ permission }) => permission !== undefined) || settingsLinks.length > 0,
  );
  const { data: viewer } = useQuery(CoreViewer, { client: clientFor(plant), skip: !gated });
  const permissions = useMemo(
    () => (viewer === undefined ? undefined : new Set(viewer.coreViewer.plantPermissions)),
    [viewer],
  );
  const companyPermissions = useMemo(
    () => (viewer === undefined ? undefined : new Set(viewer.coreViewer.companyPermissions)),
    [viewer],
  );
  const shell = useMemo(
    () => ({ plant, home: firstOpenPage(modules, plant, permissions) }),
    [modules, plant, permissions],
  );
  const loaded = data?.coreCompanies;
  const companies = loaded ?? [];
  const found = plantOf(companies, plant);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  // A page is a plant settings page when its entry is in the plant settings navigation, whether
  // or not the permissions have loaded, so its layout does not change once they do.
  const inSettings = modules
    .flatMap(plantSettingsLinks)
    .some(({ link }) => currentOf(link({ plant }).href, pathname) !== undefined);
  const shown = shownTo(permissions);
  const settingsGroups: SettingsGroup[] = settingsGroupsOf(
    modules.map((module) => ({
      moduleId: module.module.id,
      entries: plantSettingsLinks(module)
        .filter(shown)
        .map(({ label, icon, link }) => ({ label, icon, href: link({ plant }).href })),
    })),
  );
  const settingsHome = settingsGroups[0]?.entries[0]?.href;
  const companyId = found?.company.id;
  const companySettings =
    companyId !== undefined &&
    companySettingsEntries(modules, companyPermissions, companyId).some(
      ({ entries }) => entries.length > 0,
    )
      ? companySettingsHref(companyId)
      : undefined;
  const settingsTarget = settingsHome ?? companySettings;
  const settingsButton: SettingsButtonTarget | undefined =
    settingsTarget === undefined ? undefined : { href: settingsTarget, current: inSettings };
  const sidebar = useSidebarOpen(inSettings, sidebarChoice);
  const [breadcrumb, setBreadcrumb] = useState<HTMLElement | null>(null);
  const [actions, setActions] = useState<HTMLElement | null>(null);
  const plantName = found?.plant.name ?? plant;
  const topBar = useMemo<PageFrameTopBarValue>(
    () => ({
      trail: shellTrail(
        modules,
        plant,
        companies,
        pathname,
        inSettings ? (settingsHome ?? pathname) : undefined,
      ),
      titleContext: plantName,
      breadcrumb,
      actions,
    }),
    [modules, plant, companies, pathname, inSettings, settingsHome, plantName, breadcrumb, actions],
  );
  if (loaded !== undefined && found === undefined) {
    return <UnknownPlant modules={modules} plant={plant} companies={companies} main={main} />;
  }
  const page = inSettings ? (
    <ShellSettingsLayout
      column={
        <ShellSettingsNav
          company={found?.company.name ?? ''}
          title={`${plantName} settings`}
          groups={settingsGroups}
          foot={
            companySettings === undefined || found === undefined
              ? undefined
              : { label: `${found.company.name} settings`, href: companySettings }
          }
          pathname={pathname}
        />
      }
    >
      <Outlet />
    </ShellSettingsLayout>
  ) : (
    <Outlet />
  );
  return (
    <ApolloProvider client={clientFor(plant)}>
      <ShellProvider value={shell}>
        <SkipLink targetId={inSettings ? settingsContentId : mainId} />
        <SidebarProvider open={sidebar.open} onOpenChange={sidebar.onOpenChange}>
          <ShellSidebar
            id={sidebarId}
            modules={modules}
            plant={plant}
            companies={companies}
            user={session.user() ?? nobody}
            onSignOut={onSignOut}
            permissions={permissions}
          />
          <SidebarInset className="min-w-0">
            <ShellTopBar
              sidebarId={sidebarId}
              breadcrumbRef={setBreadcrumb}
              actionsRef={setActions}
              settings={settingsButton}
            />
            <PageFrameTopBar value={topBar}>
              <main
                id={mainId}
                ref={main}
                tabIndex={-1}
                className="flex-1 px-4 py-6 md:px-7 focus-visible:outline-offset-[-4px]"
              >
                {page}
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
