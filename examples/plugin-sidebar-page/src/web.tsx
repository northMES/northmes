// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { defineWebModule, type PlantRoute, useShell } from '@northmes/web-sdk';
import { createRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import packageJson from '../package.json' with { type: 'json' };

const id = 'example-sidebar-page';

/**
 * The plugin's page. It imports React, the router and the web SDK by name, and the import map
 * hands it the web build's own copies, so its hooks and useShell work inside the shell.
 */
function HelloPage() {
  const { plant } = useShell();
  const [greetings, setGreetings] = useState(0);
  // The shell's own screens name the document through their page frame; this page does it itself.
  useEffect(() => {
    document.title = 'Hello · NorthMES';
    return () => {
      document.title = 'NorthMES';
    };
  }, []);
  return (
    <div className="flex max-w-prose flex-col gap-4 p-6">
      {/* tabIndex -1: the shell moves focus to the page's h1 after a route change. */}
      <h1 tabIndex={-1} className="text-2xl font-semibold tracking-tight">
        Hello from a plugin
      </h1>
      <p className="text-sm text-muted-foreground">
        This page comes from the example plugin {id}, loaded at run time for plant {plant}.
      </p>
      <p>
        <button
          type="button"
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          onClick={() => setGreetings((count) => count + 1)}
        >
          Say hello
        </button>
      </p>
      <p role="status">{greetings === 1 ? 'Hello once.' : `Hello ${greetings} times.`}</p>
    </div>
  );
}

/** The plugin's web part: one page at /$plant/example-sidebar-page, which its sidebar entry opens. */
export default defineWebModule({
  id,
  version: packageJson.version,
  routes: (plantRoute: PlantRoute) =>
    createRoute({ getParentRoute: () => plantRoute, path: id, component: HelloPage }),
});
