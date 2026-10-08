// SPDX-License-Identifier: MIT
// A remote that imports @apollo/client/cache, a subpath outside the singleton list, and so would
// bundle its own copy of Apollo's cache.
import { InMemoryCache } from '@apollo/client/cache';
import { defineWebModule } from '@northmes/web-sdk';
import { createRoute } from '@tanstack/react-router';

export default defineWebModule({
  id: 'remote-apollo',
  version: '0.0.1',
  routes: (plantRoute) =>
    createRoute({
      getParentRoute: () => plantRoute,
      path: 'remote-apollo',
      loader: () => new InMemoryCache().extract(),
    }),
});
