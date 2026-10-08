// SPDX-License-Identifier: MIT
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { afterEach, describe, expect, it } from 'vitest';
import { configForTest } from '../src/config-for-test.ts';

const apps: INestApplication[] = [];

afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});

/** Builds a Nest app whose only module is the ConfigModule that configForTest returns. */
async function appWith(overrides: Readonly<Record<string, string>>): Promise<INestApplication> {
  const app = await NestFactory.create(await configForTest(overrides), { logger: false });
  apps.push(app);
  return app;
}

describe('configForTest', () => {
  it('E02-S02 building two apps with configForTest leaves process.env unchanged', async () => {
    const before = { ...process.env };

    const first = await appWith({ NORTHMES_PUBLIC_ORIGIN: 'http://127.0.0.1:4101' });
    const second = await appWith({ NORTHMES_PUBLIC_ORIGIN: 'http://127.0.0.1:4102' });

    expect(process.env).toEqual(before);
    // Each app reads the values of its own record, so the two share none.
    expect(first.get(ConfigService).get('NORTHMES_PUBLIC_ORIGIN')).toBe('http://127.0.0.1:4101');
    expect(second.get(ConfigService).get('NORTHMES_PUBLIC_ORIGIN')).toBe('http://127.0.0.1:4102');
  });
});
