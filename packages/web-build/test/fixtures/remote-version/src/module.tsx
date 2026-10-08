// SPDX-License-Identifier: MIT
// A remote whose defineWebModule declares version 0.3.0. Its test builds it for a module manifest
// with another version.
import { defineWebModule } from '@northmes/web-sdk';
import { createRoute } from '@tanstack/react-router';

export default defineWebModule({
  id: 'remote-version',
  version: '0.3.0',
  routes: (plantRoute) => createRoute({ getParentRoute: () => plantRoute, path: 'remote-version' }),
});
