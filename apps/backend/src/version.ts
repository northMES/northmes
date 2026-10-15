// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { readFileSync } from 'node:fs';

/**
 * The NorthMES version of this build, from the backend's package.json. Every in-repo module has
 * this version, because it ships in the backend.
 */
export function imageVersion(): string {
  const packageJson = new URL('../package.json', import.meta.url);
  return (JSON.parse(readFileSync(packageJson, 'utf8')) as { version: string }).version;
}
