// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineRemoteConfig } from '@northmes/web-build/remote';
import planningPackage from '../package.json' with { type: 'json' };

/**
 * The planning module's remote (ADR 0019). The version is the module's, which its manifest reads
 * from the same package.json, so the server serves the build under /modules/planning/<version>/.
 */
export default defineRemoteConfig({ id: 'planning', version: planningPackage.version });
