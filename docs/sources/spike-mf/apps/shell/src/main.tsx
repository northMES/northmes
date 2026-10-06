import "shell-styles";
import { ApolloProvider, useQuery } from "@apollo/client/react";
import { createNorthmesClient, ShellProvider, type WebModule } from "@northmes/web-sdk";
import { createShellRoutes } from "@northmes/web-sdk/routes";
import { TopBarProvider } from "@northmes/ui";
import {
  createRoute,
  createRouter,
  Link,
  Outlet,
  RouterProvider,
  useParams,
} from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { type EnabledRemote, type FailedRemote, loadEnabledModules } from "./federation";
import { ShellPlantQuery } from "./plant-query";

declare global {
  interface Window {
    __northmes?: Record<string, unknown>;
  }
}

const client = createNorthmesClient();

async function boot() {
  const t0 = performance.now();
  const response = await fetch("/api/web/modules?plant=plant-a", { credentials: "same-origin" });
  const { modules } = (await response.json()) as { modules: EnabledRemote[] };
  const { loaded, failed } = await loadEnabledModules(modules);
  const modulesReadyMs = Math.round(performance.now() - t0);
  const webModules: WebModule[] = loaded.map((l) => l.module);

  function RootLayout() {
    return <Outlet />;
  }

  function PlantLayout() {
    const { plant } = useParams({ strict: false }) as { plant: string };
    const { data } = useQuery(ShellPlantQuery, { variables: { id: plant } });
    const nav = webModules.flatMap((m) => m.nav).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return (
      <ShellProvider value={{ plantId: plant, userName: "Planner Petra", permissions: new Set(["planning.board.read"]) }}>
        <TopBarProvider>{(setSlot) => (
        <div className="min-h-screen bg-background text-foreground">
          <header className="flex items-center gap-4 border-b border-border p-3">
            <strong>NorthMES</strong>
            <span data-testid="shell-plant-name">{data?.plant.name ?? "loading"}</span>
            <span data-testid="shell-responsive" className="hidden md:flex">wide-screen only</span>
            <div data-testid="top-bar-slot" ref={setSlot} className="ml-auto flex gap-2" />
          </header>
          <div className="flex">
            <aside className="w-48 border-r border-border p-3">
              <ul className="flex flex-col gap-2 text-sm">
                <li><Link to="/$plant" params={{ plant }}>Dashboard</Link></li>
                {nav.map((item) => (
                  <li key={item.id}>
                    <a data-testid={`nav-${item.id}`} href={`/${plant}/${item.to}`}>{item.label}</a>
                  </li>
                ))}
                {failed.map((f) => (
                  <li key={f.id} data-testid={`nav-unavailable-${f.id}`} className="text-muted-foreground">
                    {f.id} (unavailable)
                  </li>
                ))}
              </ul>
            </aside>
            <main className="flex-1 p-4"><Outlet /></main>
          </div>
        </div>
        )}</TopBarProvider>
      </ShellProvider>
    );
  }

  const { rootRoute, plantRoute } = createShellRoutes({ root: RootLayout, plant: PlantLayout });

  const dashboardRoute = createRoute({
    getParentRoute: () => plantRoute,
    path: "/",
    component: function Dashboard() {
      const { plant } = useParams({ strict: false }) as { plant: string };
      const widgets = webModules.flatMap((m) => m.widgets).filter((w) => w.slot === "core/dashboard/widgets/v1");
      return (
        <div data-testid="dashboard" className="grid gap-3">
          {widgets.map((w) => <w.component key={w.id} plantId={plant} />)}
        </div>
      );
    },
  });

  // An enabled module whose remote failed keeps its URL space and explains itself.
  const unavailableRoutes = failed.map((f: FailedRemote) =>
    createRoute({
      getParentRoute: () => plantRoute,
      path: `${f.id}/$`,
      component: () => (
        <div data-testid="module-unavailable" className="rounded-lg border border-border p-4">
          The {f.id} module could not be loaded. Other modules work normally.
        </div>
      ),
    }),
  );

  const moduleRoutes = webModules.map((m) => m.routes(plantRoute));
  const routeTree = rootRoute.addChildren([
    plantRoute.addChildren([dashboardRoute, ...moduleRoutes, ...unavailableRoutes]),
  ]);
  // A remote that throws while rendering or loading must not blank the page: the shell
  // chrome stays and the outlet shows this panel.
  const router = createRouter({
    routeTree,
    defaultErrorComponent: ({ error }) => (
      <div data-testid="route-error" className="rounded-lg border border-border p-4">
        This screen failed: {error instanceof Error ? error.message : String(error)}
      </div>
    ),
  });

  window.__northmes = {
    client,
    router,
    loaded: loaded.map((l) => ({ id: l.module.id, ms: l.ms })),
    failed,
    modulesReadyMs,
  };

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ApolloProvider client={client}>
        <RouterProvider router={router} />
      </ApolloProvider>
    </StrictMode>,
  );
}

boot().catch((error) => {
  document.getElementById("root")!.textContent = `NorthMES failed to start: ${error}`;
});
