// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Controller, Get, Header, Inject } from '@nestjs/common';
import { listingOf, PLUGIN_WEB_PATH, type PluginListing } from './plugin-web.ts';
import { ServedWeb } from './served-web.ts';

/**
 * The plugin list of ADR 0075: each loaded plugin with screens, so the shell can import its web
 * part before it builds its router. It needs a session, like every route that is not Public, and
 * the plugin set changes only with a restart, but the answer is no-store so a sign-out leaves no
 * copy in the browser.
 */
@Controller()
export class PluginsController {
  constructor(@Inject(ServedWeb) private readonly web: ServedWeb) {}

  @Get(PLUGIN_WEB_PATH)
  @Header('Cache-Control', 'no-store')
  list(): { plugins: PluginListing[] } {
    return { plugins: this.web.plugins.map(listingOf) };
  }
}
