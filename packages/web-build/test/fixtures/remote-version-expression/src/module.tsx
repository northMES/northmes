// SPDX-License-Identifier: MIT
// A remote whose defineWebModule takes its version from an expression, which the build cannot
// read without running the remote.
import { defineWebModule } from '@northmes/web-sdk';
import { createRoute } from '@tanstack/react-router';

const version = ['0', '0', '1'].join('.');

export default defineWebModule({
  id: 'remote-version-expression',
  version,
  routes: (plantRoute) =>
    createRoute({ getParentRoute: () => plantRoute, path: 'remote-version-expression' }),
});
