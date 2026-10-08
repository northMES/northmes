// SPDX-License-Identifier: AGPL-3.0-or-later
// Preloaded with --import into a server that config.int.test.ts starts. Records the specifier of
// every import, also one that fails to resolve, and writes the list as JSON to the file that
// NM_TEST_IMPORTS_FILE names when the process exits.
import { writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';

const specifiers = [];

registerHooks({
  resolve(specifier, context, nextResolve) {
    specifiers.push(specifier);
    return nextResolve(specifier, context);
  },
});

process.on('exit', () => {
  writeFileSync(process.env.NM_TEST_IMPORTS_FILE, JSON.stringify(specifiers));
});
