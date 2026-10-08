// SPDX-License-Identifier: MIT

/** The major version of the REST API: every REST route lives under /api/v<API_MAJOR>/ (ADR 0064). */
export const API_MAJOR = 1;

/**
 * The path of a REST route, built from the value the server uses, so the shell, the stations and
 * the remotes never write the version by hand. apiPath('web', 'modules') is /api/v1/web/modules.
 */
export function apiPath(...segments: string[]): string {
  return `/api/v${API_MAJOR}/${segments.join('/')}`;
}
