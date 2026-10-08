// SPDX-License-Identifier: AGPL-3.0-or-later
import { validateWebModule } from '@northmes/web-sdk';
import { describe, expect, it } from 'vitest';
import planningPackage from '../../package.json' with { type: 'json' };
import planningModule from '../src/module.tsx';

describe('planning web module', () => {
  it("E02-S05 the planning module passes validateWebModule for the planning entry at its package's version", () => {
    // The server lists the module with the id and version of its manifest, which takes its version
    // from modules/planning/package.json.
    const entry = { id: 'planning', version: planningPackage.version };

    expect(validateWebModule(planningModule, entry)).toEqual([]);
  });
});
