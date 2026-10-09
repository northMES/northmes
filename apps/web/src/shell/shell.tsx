// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ApolloClient } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { createNorthmesClient, createShellRoutes, ShellProvider } from '@northmes/web-sdk';
import {
  createRoute,
  createRouter,
  Outlet,
  type RouterHistory,
  redirect,
  useParams,
  useRouter,
  useRouterState,
  useSearch,
} from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
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
      <PlantLayout modules={ordered} clientFor={clientFor} session={session} onSignOut={signOut} />
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

/**
 * The crumbs the shell puts before a page's own (ADR 0067): the plant, linked to the first entry of
 * the sidebar until the plant has a home page, then the module of the page, linked to its first
 * entry. A crumb whose page is the one on screen is plain text.
 */
function shellTrail(
  modules: readonly ShellModule[],
  plant: string,
  pathname: string,
): readonly Crumb[] {
  const firstHref = (module: ShellModule | undefined) => module?.links?.[0]?.link({ plant }).href;
  const crumb = (label: string, href: string | undefined): Crumb =>
    href === undefined || href === pathname ? { label } : { label, href };
  const moduleId = pathname.split('/')[2];
  const current = modules.find(({ module }) => module.id === moduleId);
  const plantHref = firstHref(modules.find(({ links = [] }) => links.length > 0));
  return [
    crumb(plant, plantHref),
    ...(current === undefined ? [] : [crumb(current.label, firstHref(current))]),
  ];
}

interface PlantLayoutProps {
  readonly modules: readonly ShellModule[];
  readonly clientFor: (plant: string) => ApolloClient;
  readonly session: AuthSession;
  readonly onSignOut: () => void;
}

/**
 * The $plant route's component, the D2 planner shell: the skip link, the sidebar, the top bar with
 * the breadcrumb and the page actions, and main with the route, inside the shell state and Apollo
 * client of the plant. The DOM order is the focus order: skip link, sidebar, top bar, main.
 */
function PlantLayout({ modules, clientFor, session, onSignOut }: PlantLayoutProps) {
  const { plant } = useParams({ strict: false });
  const main = useFocusPageHeading();
  useEffect(applyStoredTheme, []);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [breadcrumb, setBreadcrumb] = useState<HTMLElement | null>(null);
  const [actions, setActions] = useState<HTMLElement | null>(null);
  const topBar = useMemo<PageFrameTopBarValue>(
    () => ({
      trail: shellTrail(modules, plant, pathname),
      titleContext: plant,
      breadcrumb,
      actions,
    }),
    [modules, plant, pathname, breadcrumb, actions],
  );
  return (
    <ApolloProvider client={clientFor(plant)}>
      <ShellProvider value={{ plant }}>
        <SkipLink targetId={mainId} />
        <SidebarProvider>
          <ShellSidebar
            id={sidebarId}
            modules={modules}
            plant={plant}
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
