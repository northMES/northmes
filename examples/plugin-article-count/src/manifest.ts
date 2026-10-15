// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { defineModule } from '@northmes/sdk';
import packageJson from '../package.json' with { type: 'json' };

export default defineModule({
  id: 'example-article-count',
  version: packageJson.version,
  northmes: '>=0.0.0-0 <0.1.0-0',
  dependsOn: ['core'],
  web: {
    label: 'Article count',
    order: 90,
    // One widget for the dashboard's catalog (ADR 0068). Its web part supplies the component under
    // the same id, and the dashboard offers it only to a user who may read articles at the plant.
    contributes: [
      {
        id: 'example-article-count.count',
        slot: 'core/dashboard/widgets/v1',
        label: 'Article count',
        order: 10,
        permission: 'core.article:read',
      },
    ],
  },
});
