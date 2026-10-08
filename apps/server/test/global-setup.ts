// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomBytes } from 'node:crypto';
import { type PgConnection, templateDatabase } from '@northmes/testing';
import type { TestProject } from 'vitest/node';
import { bootstrapRoles } from '../src/db/bootstrap.ts';

/** Logs in to the template database as the container's superuser. */
function templateUrl({ user, password, host, port }: PgConnection): string {
  const credentials = `${encodeURIComponent(user)}:${encodeURIComponent(password)}`;
  return `postgres://${credentials}@${host}:${port}/${encodeURIComponent(templateDatabase)}`;
}

/**
 * The server's global setup in the integration project. It runs after the harness setup of
 * @northmes/testing has started Postgres and created the template. It bootstraps the database roles
 * as the container's superuser with passwords of this run, and gives the tests the passwords of
 * nm_app and nm_owner, the roles that useTestDatabase hands out (ADR 0041).
 */
export default async function setup(project: TestProject): Promise<void> {
  const { pg } = project.getProvidedContext();
  const passwords = {
    owner: randomBytes(32).toString('hex'),
    app: randomBytes(32).toString('hex'),
    auth: randomBytes(32).toString('hex'),
  };
  await bootstrapRoles(templateUrl(pg), passwords);
  project.provide('pgRolePasswords', { owner: passwords.owner, app: passwords.app });
}
