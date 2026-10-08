// SPDX-License-Identifier: AGPL-3.0-or-later
import { registerHooks } from 'node:module';
import { sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isHostProvided } from '@northmes/sdk';

/**
 * Boot step 2 (ADR 0002, ADR 0037): installs one module.registerHooks resolve hook. A
 * host-provided specifier imported from a file under one of the plugin roots resolves as if the
 * host had imported it, so the process keeps one copy of each host-provided package. Every other
 * import passes through. A plugin in plugins/ needs it as well: the repository root's package.json
 * does not depend on @nestjs/common, so plain lookup from there does not find it. Without plugins
 * it installs nothing.
 */
export function installResolveHook(pluginRoots: readonly string[]): void {
  if (pluginRoots.length === 0) return;
  const roots = pluginRoots.map((root) => pathToFileURL(`${root}${sep}`).href);
  registerHooks({
    resolve(specifier, context, nextResolve) {
      const { parentURL } = context;
      const fromPlugin =
        parentURL !== undefined && roots.some((root) => parentURL.startsWith(root));
      if (fromPlugin && isHostProvided(specifier)) {
        return nextResolve(specifier, { ...context, parentURL: import.meta.url });
      }
      return nextResolve(specifier, context);
    },
  });
}
