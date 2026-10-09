// SPDX-License-Identifier: AGPL-3.0-or-later
// pnpm --filter @northmes/backend gen:auth-migration <slug>: writes Better Auth's schema for the
// options NorthMES runs with into a new core migration file (ADR 0010). It suits a database
// without Better Auth's tables; after a Better Auth upgrade, the drift test in
// test/modules/core/auth-schema.int.test.ts names what a new migration has to add.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { authMigrationSql } from './auth-migration.ts';

const slug = process.argv[2] ?? 'auth';
if (!/^[a-z][a-z0-9_]*$/.test(slug)) {
  console.error(`Invalid slug "${slug}": use lower-case letters, digits and underscores`);
  process.exit(1);
}
const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const file = fileURLToPath(new URL(`../../migrations/${stamp}_${slug}.sql`, import.meta.url));
const header = `-- migration: expand
-- Written by pnpm --filter @northmes/backend gen:auth-migration from Better Auth's options in
-- infrastructure/auth/auth-options.ts. Better Auth's tables live in the auth schema, which migrate
-- creates owned by nm_mod_core; Better Auth's own pool logs in as nm_auth (ADR 0010).
`;
writeFileSync(file, `${header}${await authMigrationSql()}`, { flag: 'wx' });
console.log(`Wrote ${file}`);
