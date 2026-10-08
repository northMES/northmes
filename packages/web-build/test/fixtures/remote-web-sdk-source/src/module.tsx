// SPDX-License-Identifier: MIT
// A remote that imports @northmes/web-sdk's source by path instead of through its share key, and so
// would bundle its own copy of the shell's web SDK.
import { createRoute } from '@tanstack/react-router';
import { defineWebModule, validateWebModule } from '../../../../../web-sdk/src/web-module.ts';

export default defineWebModule({
  id: 'remote-web-sdk-source',
  version: '0.0.1',
  routes: (plantRoute) =>
    createRoute({
      getParentRoute: () => plantRoute,
      path: 'remote-web-sdk-source',
      loader: () => validateWebModule({}, { id: 'remote-web-sdk-source', version: '0.0.1' }),
    }),
});
