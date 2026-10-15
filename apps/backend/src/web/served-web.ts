// SPDX-License-Identifier: AGPL-3.0-or-later
import { Injectable } from '@nestjs/common';
import type { PluginWebPart } from './plugin-web.ts';

/** What the server serves to browsers. */
export interface WebFiles {
  /** The folder of the built web app, which holds index.html and assets/. */
  readonly shellDir: string;
  /** The web parts of the loaded plugins, which the shell loads at run time (ADR 0075). */
  readonly plugins?: readonly PluginWebPart[];
}

/** The web files of the app, which serveWeb hands over before the app initialises. */
@Injectable()
export class ServedWeb {
  #served?: WebFiles;

  /** Takes the web files over. */
  serve(web: WebFiles): void {
    this.#served = web;
  }

  get shellDir(): string {
    return this.#files.shellDir;
  }

  get plugins(): readonly PluginWebPart[] {
    return this.#files.plugins ?? [];
  }

  get #files(): WebFiles {
    if (!this.#served) throw new Error('serveWeb has not handed the web files to this app');
    return this.#served;
  }
}
