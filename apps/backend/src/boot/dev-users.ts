// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Client } from 'pg';
import { BootError } from './boot-error.ts';

/**
 * The ids of the stack seed's dev users (scripts/stack/seed.mjs), whose passwords are in the
 * repository: 019a0000-0000-7000-8000-0000000d0001 and up.
 */
const devUserIds = '019a0000-0000-7000-8000-0000000d%';

/**
 * Refuses a production boot while auth.user holds a dev user of the stack seed (audit W8), with a
 * BootError naming each one. The server passes a login as nm_auth, which reads every user.
 */
export async function checkNoDevUsers(url: string): Promise<void> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query<{ id: string }>(
      'select id from auth."user" where id::text like $1 order by id',
      [devUserIds],
    );
    if (rows.length === 0) return;
    throw new BootError(
      rows.map(
        ({ id }) =>
          `auth.user holds the dev user ${id} of the stack seed, whose password is public; NODE_ENV production refuses it. Use a database that pnpm dev never seeded`,
      ),
    );
  } finally {
    await client.end();
  }
}
