import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import { isHostProvided } from "@northmes/sdk/host-provided";

/**
 * Plugins outside the host's directory tree cannot find @nestjs/*, graphql or @northmes/sdk by
 * normal node_modules lookup. This in-thread hook resolves host-provided specifiers imported from
 * a plugin root as if the host had imported them, so the process keeps one copy of each.
 */
export function installPluginResolution(pluginRoots: readonly string[]) {
  const roots = pluginRoots.map((r) => pathToFileURL(r.endsWith("/") ? r : `${r}/`).href);
  const hostParent = import.meta.url;
  return registerHooks({
    resolve(specifier, context, nextResolve) {
      if (context.parentURL && roots.some((r) => context.parentURL!.startsWith(r)) && isHostProvided(specifier)) {
        return nextResolve(specifier, { ...context, parentURL: hostParent });
      }
      return nextResolve(specifier, context);
    },
  });
}
