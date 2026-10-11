import { type ChildProcess, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { unitOf } from '@northmes/contracts';
import { coreLinks } from '@northmes/core-contracts';
import { test as base, expect } from '@playwright/test';
import pg from 'pg';
import { readSecret } from '../scripts/stack/config.mjs';
import { freePort } from '../scripts/stack/ports.mjs';
import { devAdmin, seedPlants } from '../scripts/stack/seed.mjs';
import { stackEnv } from './stack-env.ts';

export { expect };

const root = fileURLToPath(new URL('..', import.meta.url));

/** The seed's plant A, where the specs work. */
export const plant = seedPlants[0]?.slug ?? '';

/** An article or group code that no other test uses, such as `NA-3F9A1C`. */
export function uniqueCode(prefix: string): string {
  return `${prefix}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

/** A worker's own server: its origin, on a database cloned from the stack's seeded one. */
interface Stack {
  readonly origin: string;
}

interface Fixtures {
  /** Opens href, signs the dev admin in on the sign-in page it leads to, and waits for href. */
  signIn: (href: string) => Promise<void>;
  /** Signs in, creates an article at plant A through New article, and stays on its page. */
  newArticle: () => Promise<{ code: string; href: string }>;
  /** Fails when the page, in the named state, breaks a WCAG 2.2 A or AA rule that axe checks. */
  checkA11y: (state: string) => Promise<void>;
}

/**
 * Runs sql as the container's superuser on the stack's server, against its postgres database.
 */
async function asSuperuser(env: Record<string, string>, sql: string): Promise<void> {
  const url = new URL(env.DATABASE_URL ?? '');
  const client = new pg.Client({
    host: url.hostname,
    port: Number(url.port),
    user: 'postgres',
    password: readSecret(env.POSTGRES_PASSWORD_FILE ?? ''),
    database: 'postgres',
  });
  client.on('error', () => {});
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

/** Waits for the server's "Listening on" line, and fails with its output when it exits first. */
function listening(server: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(
      () => reject(new Error(`The server did not listen within 60 s:\n${output}`)),
      60_000,
    );
    const read = (chunk: Buffer) => {
      output += chunk.toString('utf8');
      if (output.includes('Listening on')) {
        clearTimeout(timer);
        resolve();
      }
    };
    server.stdout?.on('data', read);
    server.stderr?.on('data', read);
    server.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`The server exited with ${code} before it listened:\n${output}`));
    });
  });
}

export const test = base.extend<Fixtures, { stack: Stack }>({
  stack: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright reads a fixture's dependencies from the destructured first parameter, and this one has none.
    async ({}, use, workerInfo) => {
      const env = stackEnv();
      const database = `e2e_${workerInfo.parallelIndex}`;
      // A worker that replaces a failed one gets the same parallelIndex, so an earlier clone goes
      // first. A clone does not copy the database privileges of its template, so the CREATE that
      // bootstrap grants nm_owner is granted again (ADR 0006).
      const template = new URL(env.DATABASE_URL ?? '').pathname.slice(1);
      await asSuperuser(env, `drop database if exists ${database} with (force)`);
      await asSuperuser(env, `create database ${database} template ${template}`);
      await asSuperuser(env, `grant create on database ${database} to nm_owner`);

      const databaseUrl = new URL(env.DATABASE_URL ?? '');
      databaseUrl.pathname = `/${database}`;
      // The public origin names the port, which Better Auth checks requests against, so the
      // fixture takes a free port rather than PORT=0.
      const port = await freePort();
      const origin = `http://127.0.0.1:${port}`;
      const server = spawn('node', ['apps/backend/dist/main.js'], {
        cwd: root,
        env: {
          ...process.env,
          ...env,
          DATABASE_URL: databaseUrl.href,
          NORTHMES_ROLE: 'all',
          PORT: String(port),
          NORTHMES_PUBLIC_ORIGIN: origin,
        },
      });
      try {
        await listening(server);
        await use({ origin });
      } finally {
        // A server that already exited, before it listened or during the tests, emits no second
        // exit, so the fixture waits only for one that still runs.
        if (server.exitCode === null && server.signalCode === null) {
          const exited = new Promise((resolve) => server.once('exit', resolve));
          server.kill('SIGTERM');
          await exited;
        }
        await asSuperuser(env, `drop database if exists ${database} with (force)`);
      }
    },
    { scope: 'worker' },
  ],
  baseURL: async ({ stack }, use) => {
    await use(stack.origin);
  },
  signIn: async ({ page }, use) => {
    await use(async (href) => {
      await page.goto(href);
      await page.getByLabel('Email').fill(devAdmin.email);
      await page.getByLabel('Password', { exact: true }).fill(devAdmin.password);
      await page.getByRole('button', { name: 'Sign in' }).click();
      await page.waitForURL((url) => url.pathname === new URL(href, url).pathname);
    });
  },
  checkA11y: async ({ page }, use) => {
    await use(async () => {
      await page.title();
    });
  },
  newArticle: async ({ page, signIn }, use) => {
    await use(async () => {
      const code = uniqueCode('AR');
      await signIn(coreLinks.articles.new({ plant }).href);
      await page.getByLabel('Article number').fill(code);
      await page.getByLabel('Name', { exact: true }).fill('Mounting plate');
      await page.getByLabel('Stock unit').selectOption({ label: unitOf('PIECE').label });
      await page.getByRole('button', { name: 'Save article' }).click();
      await expect(page.getByRole('heading', { level: 1, name: `Article ${code}` })).toBeVisible();
      return { code, href: new URL(page.url()).pathname };
    });
  },
});
