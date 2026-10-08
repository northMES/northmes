// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineModule } from '@northmes/sdk';
import { imageVersion } from '../../version.ts';

const manifest = defineModule({
  id: 'core',
  version: imageVersion(),
  northmes: '>=0.0.0-0 <0.1.0-0',
  commands: { 'core.createArticle': {}, 'core.updateArticle': {} },
  // A lazy import, so the host reads the manifest without loading Nest (ADR 0003).
  server: () => import('./index.ts'),
});

// TypeScript 6.0 leaves the .ts of an import() inside `export default <expression>` as it is,
// which the build output could not load. An exported binding gets its import() rewritten to .js.
export default manifest;
