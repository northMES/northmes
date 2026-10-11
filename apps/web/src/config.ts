// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The settings the web reads at runtime from /config.json next to index.html, so one build runs
 * behind the backend, behind a proxy or on any static host. An example config.json:
 *
 *     { "apiUrl": "https://mes.example.com" }
 */
export interface WebConfig {
  /** The URL of the API, whose /graphql the web's client calls. */
  readonly apiUrl: string;
}

/** config.json got 502, 503 or 504: the server in front of NorthMES has no answer from it yet. */
export class ServerUnavailable extends Error {
  constructor(status: number) {
    super(`config.json: the server answered ${status}`);
    this.name = 'ServerUnavailable';
  }
}

/**
 * Reads /config.json once at boot. Without the file, or without an apiUrl in it, the API is on the
 * page's origin. A host that answers a missing file with 404 or with index.html counts as having
 * no file. A 502, 503 or 504 throws ServerUnavailable, and any other server error throws.
 */
export async function loadWebConfig(
  fetch: (url: string) => Promise<Response>,
  pageOrigin: string,
): Promise<WebConfig> {
  const response = await fetch('/config.json');
  if ([502, 503, 504].includes(response.status)) throw new ServerUnavailable(response.status);
  if (response.status >= 500) {
    throw new Error(`config.json: the server answered ${response.status}`);
  }
  const json = response.ok && response.headers.get('content-type')?.includes('json') === true;
  if (!json) return { apiUrl: pageOrigin };
  const config: unknown = await response.json();
  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    throw new Error('config.json: the file must hold a JSON object');
  }
  const { apiUrl } = config as { readonly apiUrl?: unknown };
  if (apiUrl === undefined) return { apiUrl: pageOrigin };
  if (!isHttpUrl(apiUrl)) {
    throw new Error(`config.json: apiUrl must be an absolute http or https URL, got ${apiUrl}`);
  }
  return { apiUrl };
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !URL.canParse(value)) return false;
  return ['http:', 'https:'].includes(new URL(value).protocol);
}
