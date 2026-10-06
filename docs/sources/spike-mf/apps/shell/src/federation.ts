import * as ApolloClient from "@apollo/client";
import * as ApolloReact from "@apollo/client/react";
import { createInstance, type ModuleFederationRuntimePlugin } from "@module-federation/runtime";
import * as runtimeCore from "@module-federation/runtime/core";

// Remotes built with experiments.externalRuntime read the shell's runtime-core from this
// global instead of bundling their own copy (about 19 kB gzip per remote in the spike).
const federationGlobal = runtimeCore.Global as Record<string, unknown>;
federationGlobal._FEDERATION_RUNTIME_CORE = runtimeCore;
federationGlobal._FEDERATION_RUNTIME_CORE_FROM = { name: "northmes_shell", version: "2.9.2" };
import * as Ui from "@northmes/ui";
import * as WebSdk from "@northmes/web-sdk";
import {
  NORTHMES_VERSION,
  satisfiesRange,
  validateWebModule,
  type WebModule,
} from "@northmes/web-sdk";
import * as TanstackRouter from "@tanstack/react-router";
import * as React from "react";
import * as ReactDOM from "react-dom";
import * as JsxRuntime from "react/jsx-runtime";

/** One entry of GET /api/web/modules: only what the server lets this user load. */
export interface EnabledRemote {
  readonly id: string;
  readonly version: string;
  readonly remoteName: string;
  readonly manifestUrl: string;
  readonly integrity: string;
}

export interface FailedRemote {
  readonly id: string;
  readonly reason: string;
}

// The shell is a pure runtime host: no federation build plugin. It hands its own module
// instances to the runtime, so a remote always gets exactly the copy the shell renders with.
const provided: Record<string, () => Promise<unknown>> = {
  react: async () => React,
  "react-dom": async () => ReactDOM,
  "react/jsx-runtime": async () => JsxRuntime,
  "@tanstack/react-router": async () => TanstackRouter,
  "@apollo/client": async () => ApolloClient,
  "@apollo/client/react": async () => ApolloReact,
  "@northmes/web-sdk": async () => WebSdk,
  "@northmes/ui": async () => Ui,
};
if (import.meta.env.DEV) {
  provided["react/jsx-dev-runtime"] = () => import("react/jsx-dev-runtime");
}

const diagnostics: ModuleFederationRuntimePlugin = {
  name: "northmes-diagnostics",
  errorLoadRemote(args) {
    console.warn(`[northmes] remote ${args.id} failed at ${args.lifecycle}`, args.error);
    return undefined;
  },
};

// The server lists a SHA-384 per manifest. Browsers cannot attach SRI to import(), so only
// the manifest is checked here; chunks rely on same-origin, CSP and the image's file system.
const expectedManifestHashes = new Map<string, string>();

async function sha384(buffer: ArrayBuffer): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-384", buffer));
  return `sha384-${btoa(String.fromCharCode(...digest))}`;
}

const manifestIntegrity: ModuleFederationRuntimePlugin = {
  name: "northmes-manifest-integrity",
  async fetch(url, init) {
    const expected = expectedManifestHashes.get(new URL(url, location.href).pathname);
    if (!expected) return undefined;
    const response = await fetch(url, init);
    const body = await response.arrayBuffer();
    const actual = await sha384(body);
    if (actual !== expected) throw new Error(`manifest integrity mismatch for ${url}`);
    return new Response(body, { status: response.status, headers: response.headers });
  },
};

export const mf = createInstance({ name: "northmes_shell", remotes: [], plugins: [diagnostics, manifestIntegrity] });

mf.registerShared(
  Object.fromEntries(
    Object.entries(provided).map(([key, load]) => {
      const version = __SHARED_VERSIONS__[key] ?? (key.startsWith("react") ? React.version : "0.0.0");
      return [
        key,
        {
          version,
          scope: "default",
          get: async () => {
            const mod = await load();
            return () => mod;
          },
          shareConfig: { singleton: true, requiredVersion: false, strictVersion: false },
        },
      ];
    }),
  ),
);

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}: timed out after ${ms} ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function loadEnabledModules(remotes: readonly EnabledRemote[]) {
  for (const r of remotes) if (r.integrity) expectedManifestHashes.set(new URL(r.manifestUrl, location.href).pathname, r.integrity);
  mf.registerRemotes(remotes.map((r) => ({ name: r.remoteName, entry: r.manifestUrl })));
  const settled = await Promise.allSettled(
    remotes.map(async (remote) => {
      const started = performance.now();
      const entry = await withTimeout(
        mf.loadRemote<{ default: WebModule }>(`${remote.remoteName}/module`),
        8000,
        remote.id,
      );
      const module = entry?.default;
      const errors = validateWebModule(module, remote.id);
      if (errors.length > 0) throw new Error(errors.join("; "));
      if (!satisfiesRange(NORTHMES_VERSION, module!.northmesRange)) {
        throw new Error(`${remote.id} supports NorthMES ${module!.northmesRange}; this shell is ${NORTHMES_VERSION}`);
      }
      return { module: module!, ms: Math.round(performance.now() - started) };
    }),
  );
  const loaded: { module: WebModule; ms: number }[] = [];
  const failed: FailedRemote[] = [];
  settled.forEach((result, i) => {
    if (result.status === "fulfilled") loaded.push(result.value);
    else failed.push({ id: remotes[i]!.id, reason: String(result.reason?.message ?? result.reason) });
  });
  return { loaded, failed };
}
