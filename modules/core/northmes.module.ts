// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineModule } from '@northmes/sdk';
import packageJson from './package.json' with { type: 'json' };

const manifest = defineModule({
  id: 'core',
  version: packageJson.version,
  northmes: '>=0.0.0-0 <0.1.0-0',
  // A lazy import, so the host reads the manifest without loading Nest (ADR 0003).
  server: () => import('./server/index.ts'),
});

// TypeScript 6.0 leaves the .ts of an import() inside `export default <expression>` as it is,
// which the build output could not load. An exported binding gets its import() rewritten to .js.
export default manifest;
