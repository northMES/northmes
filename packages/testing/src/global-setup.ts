// SPDX-License-Identifier: MIT
import { readFileSync } from 'node:fs';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';
import type { PgConnection } from './database.ts';

const imageFile = new URL('../../../infra/pg-image.json', import.meta.url);

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const { image } = JSON.parse(readFileSync(imageFile, 'utf8')) as { image: string };
  const container = await new PostgreSqlContainer(image).start();

  const connection: PgConnection = {
    host: container.getHost(),
    port: container.getPort(),
    user: container.getUsername(),
    password: container.getPassword(),
    database: container.getDatabase(),
  };
  project.provide('pg', connection);

  return async () => {
    await container.stop();
  };
}
