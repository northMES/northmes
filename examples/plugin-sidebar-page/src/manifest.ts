// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { defineModule } from '@northmes/sdk';
import packageJson from '../package.json' with { type: 'json' };

export default defineModule({
  id: 'example-sidebar-page',
  version: packageJson.version,
  northmes: '>=0.0.0-0 <0.1.0-0',
  dependsOn: ['core'],
  // The sidebar group: its label, its icon by lucide name (ADR 0067) and its place among the
  // modules' groups. The plugin has screens only, so it has no server entry.
  web: { label: 'Hello', icon: 'Handshake', order: 90 },
});
