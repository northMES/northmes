// SPDX-License-Identifier: MIT
import { readFileSync } from 'node:fs';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';
import { type PgConnection, templateDatabase, withClient } from './database.ts';

const imageFile = new URL('../../../infra/pg-image.json', import.meta.url);

async function createTemplate(connection: PgConnection): Promise<void> {
  await withClient(connection, async (client) => {
    await client.query(`create database ${client.escapeIdentifier(templateDatabase)}`);
  });
  // The client closes before the first clone: Postgres refuses to copy a database in use.
  await withClient({ ...connection, database: templateDatabase }, async (client) => {
    await client.query('create table nm_marker (id integer primary key)');
  });
}

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
  await createTemplate(connection);
  project.provide('pg', connection);
  project.provide('pgImage', image);

  return async () => {
    await container.stop();
  };
}
