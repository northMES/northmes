// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineModule } from '@northmes/sdk';
import packageJson from './package.json' with { type: 'json' };

export default defineModule({
  id: 'planning',
  version: packageJson.version,
  northmes: '>=0.0.0-0 <0.1.0-0',
  dependsOn: ['core'],
  commands: { 'planning.releaseProductionOrder': { validatable: true } },
});
