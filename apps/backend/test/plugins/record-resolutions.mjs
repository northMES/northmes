// SPDX-License-Identifier: AGPL-3.0-or-later
// Preloaded with --import into a server that load.int.test.ts starts. Records the specifier of
// every import that resolves and the file URL it resolves to, and writes the list as JSON to the
// file that NM_TEST_RESOLUTIONS_FILE names when the process exits. A hook that boot registers
// later runs before this one, so the URL recorded is the one after any mapping of boot's.
import { writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';

const resolutions = [];

registerHooks({
  resolve(specifier, context, nextResolve) {
    const resolved = nextResolve(specifier, context);
    resolutions.push({ specifier, url: resolved.url });
    return resolved;
  },
});

process.on('exit', () => {
  writeFileSync(process.env.NM_TEST_RESOLUTIONS_FILE, JSON.stringify(resolutions));
});
