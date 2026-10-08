// SPDX-License-Identifier: MIT
// A remote that imports graphql itself and so would bundle a second copy beside the one the
// shell's Apollo Client uses.
import { defineWebModule } from '@northmes/web-sdk';
import { createRoute } from '@tanstack/react-router';
import { parse, print } from 'graphql';

export default defineWebModule({
  id: 'remote-graphql',
  version: '0.0.1',
  routes: (plantRoute) =>
    createRoute({
      getParentRoute: () => plantRoute,
      path: 'remote-graphql',
      loader: () => print(parse('{ planningProductionOrders { id } }')),
    }),
});
