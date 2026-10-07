import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** A module's built remote on disk, as the image would hold it: <root>/<id>/<version>/. */
export interface RemoteOnDisk {
  readonly id: string;
  readonly version: string;
  readonly remoteName: string;
  readonly dir: string;
  readonly permission: string;
}

export function sriOf(file: string): string | null {
  if (!existsSync(file)) return null;
  return `sha384-${createHash("sha384").update(readFileSync(file)).digest("base64")}`;
}

/**
 * The list a browser may load. Disabled modules and plugins, and modules the user has no
 * permission for, are never returned, so their code is never fetched.
 */
export function enabledRemotesFor(
  installed: readonly RemoteOnDisk[],
  enabled: ReadonlySet<string>,
  userPermissions: ReadonlySet<string>,
) {
  return installed
    .filter((r) => enabled.has(r.id) && userPermissions.has(r.permission))
    .map((r) => ({
      id: r.id,
      version: r.version,
      remoteName: r.remoteName,
      manifestUrl: `/modules/${r.id}/${r.version}/mf-manifest.json`,
      integrity: process.env.TAMPER_MANIFEST === r.id ? "sha384-AAAA" : sriOf(join(r.dir, "mf-manifest.json")),
    }));
}
