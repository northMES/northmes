// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineRemoteConfig } from '@northmes/web-build/remote';
import planningPackage from './package.json' with { type: 'json' };

/** The planning module's remote (ADR 0019), with the version of its package. */
export default defineRemoteConfig({ id: 'planning', version: planningPackage.version });
