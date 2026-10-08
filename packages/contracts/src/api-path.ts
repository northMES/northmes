// SPDX-License-Identifier: MIT

/** The major version of the REST API: every REST route lives under /api/v<API_MAJOR>/ (ADR 0064). */
export const API_MAJOR = 1;

/**
 * The path of a REST route, built from the value the server uses, so the shell, the stations and
 * the remotes never write the version by hand. apiPath('web', 'modules') is /api/v1/web/modules.
 * Each segment is percent-encoded, so an id with / ? or # stays one path segment. An empty, . or ..
 * segment throws, because URL parsing would drop it or climb out of the route.
 */
export function apiPath(...segments: string[]): string {
  for (const segment of segments) {
    if (segment === '' || segment === '.' || segment === '..') {
      throw new Error(`apiPath segment ${JSON.stringify(segment)} is not a path segment`);
    }
  }
  return `/api/v${API_MAJOR}/${segments.map(encodeURIComponent).join('/')}`;
}
