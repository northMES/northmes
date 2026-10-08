// SPDX-License-Identifier: MIT
import { defineWebModule, type PlantRoute, validateWebModule } from '@northmes/web-sdk';
import { createRoute } from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';

// The server's entry for the planning module in the web module list.
const entry = { id: 'planning', version: '0.4.0' };

// A routes function whose top route has the given path under /$plant.
function routesAt(path: string) {
  return (plantRoute: PlantRoute) => createRoute({ getParentRoute: () => plantRoute, path });
}

const planning = defineWebModule({
  id: 'planning',
  version: '0.4.0',
  routes: routesAt('planning'),
});

describe('validateWebModule', () => {
  it('E02-S05 validateWebModule finds no problem in a module that matches its server entry', () => {
    expect(validateWebModule(planning, entry)).toEqual([]);
  });

  it('E02-S05 validateWebModule names a missing id, a version that differs from the server entry and a route path that is not the module id', () => {
    expect(validateWebModule({ ...planning, id: undefined }, entry)).toEqual([
      'id is missing, expected planning from the server entry',
    ]);
    expect(validateWebModule({ ...planning, version: '0.3.0' }, entry)).toEqual([
      'version is 0.3.0, expected 0.4.0 from the server entry',
    ]);
  });
});
