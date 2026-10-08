// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineModule } from '@northmes/sdk';
import packageJson from '../package.json' with { type: 'json' };

export default defineModule({
  id: 'example-validator',
  version: packageJson.version,
  northmes: '>=0.0.0-0 <0.1.0-0',
  dependsOn: ['planning'],
  // A lazy import, so the host reads the manifest without loading Nest (ADR 0003).
  server: () => import('./server.ts'),
});
