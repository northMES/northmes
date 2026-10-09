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

/**
 * Reads /config.json once at boot. Without the file, or without an apiUrl in it, the API is on the
 * page's origin. A host that answers a missing file with index.html counts as having no file.
 */
export async function loadWebConfig(
  fetch: (url: string) => Promise<Response>,
  pageOrigin: string,
): Promise<WebConfig> {
  const response = await fetch('/config.json');
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
