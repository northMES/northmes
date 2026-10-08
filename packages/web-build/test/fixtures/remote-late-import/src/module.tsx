// SPDX-License-Identifier: MIT
// A remote whose entry imports createRoute from @tanstack/react-router while ./missing-order,
// which a test loads late, imports notFound from it.
import { defineWebModule } from '@northmes/web-sdk';
import { createRoute } from '@tanstack/react-router';
import { missingOrder } from './missing-order.ts';

export default defineWebModule({
  id: 'remote-late-import',
  version: '0.0.1',
  routes: (plantRoute) =>
    createRoute({
      getParentRoute: () => plantRoute,
      path: 'remote-late-import',
      loader: () => missingOrder(),
    }),
});
