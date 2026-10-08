// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ShellModule } from './modules.ts';

/** The E02 menu: a plain list with one entry per module, by the modules' order. */
export function Menu({ modules }: { modules: readonly ShellModule[] }) {
  const ordered = [...modules].sort((a, b) => a.order - b.order);
  return (
    <nav aria-label="Modules">
      <ul>
        {ordered.map(({ module, label }) => (
          <li key={module.id}>{label}</li>
        ))}
      </ul>
    </nav>
  );
}
