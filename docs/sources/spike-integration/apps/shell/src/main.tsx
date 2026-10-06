import "shell-styles";
import { ApolloProvider } from "@apollo/client/react";
import {
  createNorthmesClient, ShellProvider, Slot, SlotRegistryProvider, type SlotContribution, type WebModule,
} from "@northmes/web-sdk";
import { createShellRoutes } from "@northmes/web-sdk/routes";
import { TopBarProvider } from "@northmes/ui";
import { createRoute, createRouter, Outlet, RouterProvider, useParams } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { type EnabledRemote, type FailedRemote, loadEnabledModules } from "./federation";

declare global {
  interface Window {
    __northmes?: Record<string, unknown>;
  }
}

const plantFromUrl = () => location.pathname.split("/")[1] || "P1";
const client = createNorthmesClient({ plant: plantFromUrl });

/**
 * Slot contributions are accepted only when the slot belongs to the contributor itself or to a
 * module in its dependsOn closure. The facts come from the server's module list (backend
 * manifests), not from the remote's own code.
 */
function buildSlotRegistry(remotes: readonly EnabledRemote[], loaded: readonly WebModule[]) {
  const ownerOf = new Map<string, string>();
  for (const r of remotes) for (const s of r.ownsSlots) ownerOf.set(s, r.id);
  const facts = new Map(remotes.map((r) => [r.id, r]));
  const registry = new Map<string, SlotContribution[]>();
  const rejected: string[] = [];
  for (const m of loaded) {
    for (const c of m.contributions) {
      const owner = ownerOf.get(c.slot);
      const allowed = owner && (owner === m.id || facts.get(m.id)?.dependsOn.includes(owner));
      if (!allowed) {
        rejected.push(`${m.id}:${c.id} -> ${c.slot}`);
        continue;
      }
      registry.set(c.slot, [...(registry.get(c.slot) ?? []), c]);
    }
  }
  for (const list of registry.values()) list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id));
  return { registry, rejected };
}

async function boot() {
  const t0 = performance.now();
  const response = await fetch(`/api/web/modules?plant=${encodeURIComponent(plantFromUrl())}`, { credentials: "same-origin" });
  const { modules, supergraph } = (await response.json()) as { modules: EnabledRemote[]; supergraph: string };
  const { loaded, failed } = await loadEnabledModules(modules);
  const webModules: WebModule[] = loaded.map((l) => l.module);
  const { registry, rejected } = buildSlotRegistry(modules, webModules);
  const modulesReadyMs = Math.round(performance.now() - t0);

  function PlantLayout() {
    const { plant } = useParams({ strict: false }) as { plant: string };
    const nav = webModules.flatMap((m) => m.nav).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return (
      <ShellProvider value={{ plantId: plant, userName: "Planner Alice", permissions: new Set() }}>
        <TopBarProvider>{(setSlot) => (
          <div className="min-h-screen bg-background text-foreground">
            <header className="flex items-center gap-4 border-b border-border p-3">
              <strong>NorthMES</strong>
              <span data-testid="shell-plant">{plant}</span>
              <span data-testid="shell-responsive" className="hidden md:flex">wide-screen only</span>
              <div data-testid="top-bar-slot" ref={setSlot} className="ml-auto flex gap-2" />
            </header>
            <div className="flex">
              <aside className="w-48 border-r border-border p-3">
                <ul className="flex flex-col gap-2 text-sm">
                  {nav.map((item) => <li key={item.id}><a data-testid={`nav-${item.id}`} href={`/${plant}/${item.to}`}>{item.label}</a></li>)}
                  {failed.map((f) => <li key={f.id} data-testid={`nav-unavailable-${f.id}`}>{f.id} (unavailable)</li>)}
                </ul>
              </aside>
              <main className="flex-1 p-4"><Outlet /></main>
            </div>
          </div>
        )}</TopBarProvider>
      </ShellProvider>
    );
  }

  const { rootRoute, plantRoute } = createShellRoutes({ root: () => <Outlet />, plant: PlantLayout });
  const dashboardRoute = createRoute({
    getParentRoute: () => plantRoute,
    path: "/",
    component: () => <div data-testid="dashboard"><Slot id="core/dashboard/widgets/v1" props={{ plantId: plantFromUrl() }} /></div>,
  });
  const unavailableRoutes = failed.map((f: FailedRemote) =>
    createRoute({ getParentRoute: () => plantRoute, path: `${f.id}/$`, component: () => <div data-testid="module-unavailable">The {f.id} module could not be loaded.</div> }),
  );
  const moduleRoutes = webModules.flatMap((m) => (m.routes ? [m.routes(plantRoute)] : []));
  const routeTree = rootRoute.addChildren([plantRoute.addChildren([dashboardRoute, ...moduleRoutes, ...unavailableRoutes])]);
  const router = createRouter({
    routeTree,
    defaultErrorComponent: ({ error }) => <div data-testid="route-error">This screen failed: {error instanceof Error ? error.message : String(error)}</div>,
  });

  window.__northmes = { client, router, supergraph, loaded: loaded.map((l) => ({ id: l.module.id, ms: l.ms })), failed, rejected, modulesReadyMs, slots: [...registry].map(([k, v]) => [k, v.map((c) => c.id)]) };

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ApolloProvider client={client}>
        <SlotRegistryProvider value={registry}>
          <RouterProvider router={router} />
        </SlotRegistryProvider>
      </ApolloProvider>
    </StrictMode>,
  );
}

boot().catch((error) => {
  document.getElementById("root")!.textContent = `NorthMES failed to start: ${error}`;
});
