// SPDX-License-Identifier: MIT
// A remote that imports a stylesheet of its own, which in-repo remotes never do (ADR 0019).
import { defineWebModule } from '@northmes/web-sdk';
import { createRoute } from '@tanstack/react-router';
import './styles.css';

export default defineWebModule({
  id: 'remote-css',
  version: '0.0.1',
  routes: (plantRoute) => createRoute({ getParentRoute: () => plantRoute, path: 'remote-css' }),
});
