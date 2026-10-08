// SPDX-License-Identifier: MIT
import 'reflect-metadata';
import { PATH_METADATA } from '@nestjs/common/constants';
import { API_CONTROLLER_METADATA, ApiController } from '@northmes/sdk/rest';
import { describe, expect, it } from 'vitest';

describe('ApiController', () => {
  it('E02-S03 ApiController({ module: "web", family: "first-party" }) registers api/v1/web and records family first-party and module web', () => {
    @ApiController({ module: 'web', family: 'first-party' })
    class WebModulesController {}

    expect(Reflect.getMetadata(PATH_METADATA, WebModulesController)).toBe('api/v1/web');
    expect(Reflect.getMetadata(API_CONTROLLER_METADATA, WebModulesController)).toEqual({
      module: 'web',
      family: 'first-party',
    });
  });
});
