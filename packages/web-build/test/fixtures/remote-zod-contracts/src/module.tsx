// SPDX-License-Identifier: MIT
// A remote that bundles zod and a module's contracts package, as every remote does (ADR 0062).
import { releaseProductionOrder } from '@northmes/planning-contracts';
import { defineWebModule } from '@northmes/web-sdk';
import { createRoute } from '@tanstack/react-router';
import { z } from 'zod';

const search = z.object({ orderId: z.uuid() });

export default defineWebModule({
  id: 'remote-zod-contracts',
  version: '0.0.1',
  routes: (plantRoute) =>
    createRoute({
      getParentRoute: () => plantRoute,
      path: 'remote-zod-contracts',
      validateSearch: search,
      loader: () => releaseProductionOrder.name,
    }),
});
