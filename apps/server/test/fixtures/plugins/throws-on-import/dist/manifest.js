// SPDX-License-Identifier: AGPL-3.0-or-later
// A built plugin whose server part throws when boot imports it.
import { defineModule } from '@northmes/sdk';

export default defineModule({
  id: 'throws-on-import',
  version: '0.0.0',
  northmes: '>=0.0.0-0 <0.1.0-0',
  server: () => import('./server.js'),
});
