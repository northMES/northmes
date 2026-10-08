// SPDX-License-Identifier: AGPL-3.0-or-later
import type { LoadedModule } from './federation.ts';

/**
 * The E02 menu: a plain list with one entry per listed module, in the order of the modules'
 * manifests. A module whose remote failed to load keeps its position and reads "(unavailable)".
 */
export function Menu({ modules }: { modules: readonly LoadedModule[] }) {
  const ordered = [...modules].sort((a, b) => a.listed.order - b.listed.order);
  return (
    <nav aria-label="Modules">
      <ul>
        {ordered.map(({ listed, module }) => (
          <li key={listed.id}>
            {module === null ? `${listed.label} (unavailable)` : listed.label}
          </li>
        ))}
      </ul>
    </nav>
  );
}
