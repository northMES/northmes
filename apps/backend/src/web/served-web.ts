// SPDX-License-Identifier: AGPL-3.0-or-later
import { Injectable } from '@nestjs/common';

/** What the server serves to browsers. */
export interface WebFiles {
  /** The folder of the built web app, which holds index.html and assets/. */
  readonly shellDir: string;
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
    if (!this.#served) throw new Error('serveWeb has not handed the web files to this app');
    return this.#served.shellDir;
  }
}
