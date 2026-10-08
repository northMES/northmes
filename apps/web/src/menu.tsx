// SPDX-License-Identifier: AGPL-3.0-or-later
import { Link } from '@tanstack/react-router';
import type { ShellModule } from './modules.ts';

/**
 * The E02 menu: one group per module by the modules' order, each a list of the module's links for
 * the plant in the URL, named by the group's label.
 */
export function Menu({ modules, plant }: { modules: readonly ShellModule[]; plant: string }) {
  const ordered = [...modules].sort((a, b) => a.order - b.order);
  return (
    <nav aria-label="Modules">
      <ul>
        {ordered.map(({ module, label, links = [] }) => {
          const labelId = `menu-group-${module.id}`;
          return (
            <li key={module.id}>
              <span id={labelId}>{label}</span>
              <ul aria-labelledby={labelId}>
                {links.map((entry) => (
                  <li key={entry.label}>
                    <Link to={entry.link({ plant }).href}>{entry.label}</Link>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
