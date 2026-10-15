// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineWebModule, type PlantRoute, type WebModule } from '@northmes/web-sdk';
import { createRoute } from '@tanstack/react-router';
import { RotateCw } from 'lucide-react';
import type { ShellModule } from '../modules.ts';
import { PageFrame } from '../ui/components/page-frame/index.ts';
import type { NavIconName } from '../ui/lib/nav-icon-names.ts';
import { Button } from '../ui/primitives/button.tsx';

/** What GET /api/v1/web/plugins says of one plugin with screens (ADR 0075). */
export interface PluginListing {
  readonly id: string;
  readonly version: string;
  /** The URL of the web part's entry, from the API's origin. */
  readonly entry: string;
  readonly label: string;
  /** A lucide name of the shell's nav icons; NavIcon draws Shapes for any other. */
  readonly icon?: string;
  readonly order: number;
  readonly permission?: string;
  readonly contributes: readonly unknown[];
}

export interface LoadPluginsOptions {
  /** The URL of the API, from config.json. */
  readonly apiUrl: string;
  /** The session's JWT, or undefined while nobody is signed in. */
  readonly token: () => Promise<string | undefined>;
  readonly fetch: (url: string, init: RequestInit) => Promise<Response>;
  /** Imports a module script by its URL: import() in the browser. */
  readonly importModule: (url: string) => Promise<{ readonly default?: unknown }>;
  /** How long the list or an import may take before it counts as failed: 10 s (ADR 0019). */
  readonly timeoutMs?: number;
}

/** How long the list or an import may take: 10 s (ADR 0019). */
const DEFAULT_TIMEOUT_MS = 10_000;

/** The path of the plugin list under the API's URL. */
const PLUGIN_LIST_PATH = '/api/v1/web/plugins';

/** The API's URL and a path under it, with one slash between them. */
function apiPath(apiUrl: string, path: string): string {
  return `${apiUrl.replace(/\/+$/, '')}${path}`;
}

/**
 * The plugin list, or none when nobody is signed in or the list does not load, or does not load
 * within the timeout.
 */
async function listPlugins({
  apiUrl,
  token,
  fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: LoadPluginsOptions): Promise<PluginListing[]> {
  try {
    const jwt = await token();
    if (jwt === undefined) return [];
    const response = await within(
      fetch(apiPath(apiUrl, PLUGIN_LIST_PATH), {
        headers: { authorization: `Bearer ${jwt}` },
        signal: AbortSignal.timeout(timeoutMs),
      }),
      timeoutMs,
    );
    if (!response.ok) throw new Error(`the plugin list answered ${response.status}`);
    const { plugins } = (await response.json()) as { plugins: PluginListing[] };
    return plugins;
  } catch (error) {
    // The shell still starts, with the in-repo modules; the console keeps the reason.
    console.error('NorthMES could not list the plugins:', error);
    return [];
  }
}

/** Whether `value` is the web module of `listing`: its id and version, and its routes. */
function isWebModuleOf(value: unknown, listing: PluginListing): value is WebModule {
  if (typeof value !== 'object' || value === null) return false;
  const module = value as Partial<WebModule>;
  return (
    module.id === listing.id &&
    module.version === listing.version &&
    typeof module.routes === 'function'
  );
}

/** Rejects after `ms` milliseconds unless `promise` settles first. */
function within<Value>(promise: Promise<Value>, ms: number): Promise<Value> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no answer within ${ms} ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** The page of a plugin that did not load: its name, and Reload page (ADR 0075). */
export function UnavailablePluginPage({ label }: { readonly label: string }) {
  return (
    <PageFrame title={`${label} is unavailable`}>
      <div className="flex max-w-prose flex-col items-start gap-4">
        <p className="text-sm text-muted-foreground">
          This plugin did not load. Reload the page to try again. If it still does not load, tell
          your administrator.
        </p>
        <Button onClick={() => location.reload()}>
          <RotateCw aria-hidden />
          Reload page
        </Button>
      </div>
    </PageFrame>
  );
}

/** The stand-in web module of a plugin that did not load: its unavailable page at /$plant/<id>. */
function unavailableModule({ id, version, label }: PluginListing): WebModule {
  const page = () => <UnavailablePluginPage label={label} />;
  return defineWebModule({
    id,
    version,
    routes: (plantRoute: PlantRoute) => {
      const route = createRoute({ getParentRoute: () => plantRoute, path: id, component: page });
      return route.addChildren([
        createRoute({ getParentRoute: () => route, path: '$', component: page }),
      ]);
    },
  });
}

/** A plugin's sidebar group: its label at its order, with one entry to its page. */
function shellModuleOf(listing: PluginListing, module: WebModule, entry: string): ShellModule {
  const { id, label, icon, order, permission } = listing;
  return {
    module,
    label,
    order,
    links: [
      {
        label: entry,
        icon: (icon ?? 'Shapes') as NavIconName,
        link: ({ plant }) => ({ href: `/${plant}/${id}` }),
        ...(permission === undefined ? {} : { permission }),
      },
    ],
  };
}

/**
 * Loads the screens of the plugins the API lists for the signed-in user (ADR 0075, shell boot
 * steps 3 to 5): it imports every entry in parallel and returns each plugin as a module of the
 * shell, in the list's order. A plugin whose import fails, takes longer than the timeout or does
 * not export its web module gets an unavailable page and sidebar entry instead, so the shell still
 * starts.
 */
export async function loadPlugins(options: LoadPluginsOptions): Promise<ShellModule[]> {
  const { apiUrl, importModule, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const listings = await listPlugins(options);
  return Promise.all(
    listings.map(async (listing) => {
      try {
        const { default: module } = await within(
          importModule(apiPath(apiUrl, listing.entry)),
          timeoutMs,
        );
        if (!isWebModuleOf(module, listing)) {
          throw new Error(`its entry exports no web module ${listing.id} ${listing.version}`);
        }
        return shellModuleOf(listing, module, listing.label);
      } catch (error) {
        console.error(`NorthMES could not load the plugin ${listing.id}:`, error);
        return shellModuleOf(listing, unavailableModule(listing), `${listing.label} (unavailable)`);
      }
    }),
  );
}
