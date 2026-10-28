// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

interface Service {
  image?: string;
  command?: string | string[];
  restart?: string;
  depends_on?: Record<string, { condition: string; required?: boolean }>;
  profiles?: string[];
  secrets?: (string | { source: string })[];
  environment?: Record<string, string>;
  ports?: string[];
  volumes?: string[];
  read_only?: boolean;
  tmpfs?: string[];
  cap_drop?: string[];
  security_opt?: string[];
  mem_limit?: string;
  healthcheck?: { test: string[] };
}

interface Compose {
  services: Record<string, Service>;
  secrets?: Record<string, { file: string }>;
}

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const compose = parse(read('deploy/compose.yaml')) as Compose;
const { services } = compose;
const pgImage = (JSON.parse(read('infra/pg-image.json')) as { image: string }).image;
// A Compose interpolation, not a template literal.
// biome-ignore lint/suspicious/noTemplateCurlyInString: Compose reads the placeholder from .env.
const northmesImage = 'ghcr.io/northmes/northmes:${NORTHMES_VERSION:?set NORTHMES_VERSION in .env}';

const secretsOf = (service: Service | undefined) =>
  (service?.secrets ?? []).map((secret) => (typeof secret === 'string' ? secret : secret.source));

/** The default of each `${VAR:-default}` interpolation in compose.yaml, by variable. */
const composeDefaults: Record<string, string> = Object.fromEntries(
  [...read('deploy/compose.yaml').matchAll(/\$\{([A-Z_]+):-([^}]*)\}/g)].map(([, name, value]) => [
    name,
    value,
  ]),
);

/** The assignments of deploy/northmes.env.example: the active lines and the commented-out ones. */
function exampleEnv(): { active: Record<string, string>; commented: Record<string, string> } {
  const active: Record<string, string> = {};
  const commented: Record<string, string> = {};
  for (const line of read('deploy/northmes.env.example').split('\n')) {
    const match = /^(#\s*)?([A-Z_]+)=(.*)$/.exec(line);
    if (match?.[2] === undefined) continue;
    (match[1] === undefined ? active : commented)[match[2]] = match[3] ?? '';
  }
  return { active, commented };
}

describe('the Compose bundle (ADR 0080)', () => {
  it('runs db, bootstrap, migrate, app and caddy, and backup when its profile is on', () => {
    expect(Object.keys(services).sort()).toEqual([
      'app',
      'backup',
      'bootstrap',
      'caddy',
      'db',
      'migrate',
    ]);
  });

  it('every NorthMES service reads its image from the one NORTHMES_VERSION line in .env', () => {
    for (const name of ['bootstrap', 'migrate', 'app']) {
      expect(services[name]?.image, name).toBe(northmesImage);
    }
  });

  it('pins the db image to infra/pg-image.json', () => {
    expect(services.db?.image).toBe(pgImage);
  });

  it('runs bootstrap and migrate once, and starts app only after migrate exits 0', () => {
    expect(services.bootstrap?.restart).toBe('no');
    expect(services.migrate?.restart).toBe('no');
    expect(services.migrate?.depends_on?.bootstrap?.condition).toBe(
      'service_completed_successfully',
    );
    expect(services.app?.depends_on?.migrate?.condition).toBe('service_completed_successfully');
    expect(services.bootstrap?.command).toEqual(['db', 'bootstrap']);
    expect(services.migrate?.command).toEqual(['migrate']);
  });

  // backup dumps as the admin, which reads every table past row-level security (ADR 0045).
  it('gives the superuser password only to db, bootstrap and backup', () => {
    const holders = Object.entries(services)
      .filter(([, service]) => secretsOf(service).includes('postgres_password'))
      .map(([name]) => name)
      .sort();

    expect(holders).toEqual(['backup', 'bootstrap', 'db']);
  });

  it('gives the nm_owner password only to bootstrap and migrate, never to app', () => {
    const holders = Object.entries(services)
      .filter(([, service]) => secretsOf(service).includes('db_owner_password'))
      .map(([name]) => name)
      .sort();

    expect(holders).toEqual(['bootstrap', 'migrate']);
  });

  it('reads every secret from a file under secrets/, never from the environment', () => {
    for (const [name, secret] of Object.entries(compose.secrets ?? {})) {
      expect(secret.file, name).toMatch(/^\.\/secrets\/[a-z_]+$/);
    }
    for (const [name, service] of Object.entries(services)) {
      for (const [key, value] of Object.entries(service.environment ?? {})) {
        if (/PASSWORD|SECRET/.test(key)) expect(key, `${name} ${key}=${value}`).toMatch(/_FILE$/);
      }
    }
  });

  it('publishes only caddy, and app serves the production origin over https', () => {
    const published = Object.entries(services)
      .filter(([, service]) => (service.ports ?? []).length > 0)
      .map(([name]) => name);

    expect(published).toEqual(['caddy']);
    expect(services.app?.environment?.NODE_ENV).toBe('production');
    expect(services.app?.environment?.NORTHMES_PUBLIC_ORIGIN).toMatch(/^https:\/\//);
    // app listens on the Compose network, which only caddy publishes.
    expect(services.app?.environment?.NORTHMES_LISTEN_HOST).toBe('0.0.0.0');
    // caddy is the one proxy in front of app, so sign-in is throttled per client it reports (#476).
    expect(services.app?.environment?.NORTHMES_TRUSTED_PROXY_HOPS).toBe('1');
  });

  it('runs bootstrap, migrate and app read-only, with no capabilities and no new privileges (ADR 0044)', () => {
    for (const name of ['bootstrap', 'migrate', 'app']) {
      const service = services[name];
      expect(service?.read_only, name).toBe(true);
      expect(service?.tmpfs, name).toEqual(['/tmp']);
      expect(service?.cap_drop, name).toEqual(['ALL']);
      expect(service?.security_opt, name).toEqual(['no-new-privileges:true']);
    }
  });

  it('caps app memory from .env with a default that the example .env shows, and checks app health with node, which the image has', () => {
    expect(services.app?.mem_limit).toMatch(/^\$\{NORTHMES_APP_MEM_LIMIT:-\d+[gm]\}$/);
    expect(services.app?.healthcheck?.test.slice(0, 2)).toEqual(['CMD', 'node']);
    expect(exampleEnv().commented.NORTHMES_APP_MEM_LIMIT).toBe(
      composeDefaults.NORTHMES_APP_MEM_LIMIT,
    );
  });

  it("passes the public API's rate limits from .env to app, off by default, with the limits the example .env shows (ADR 0073)", () => {
    const { commented } = exampleEnv();

    for (const name of [
      'NORTHMES_API_RATE_LIMIT',
      'NORTHMES_API_RATE_LIMIT_READS',
      'NORTHMES_API_RATE_LIMIT_WRITES',
    ]) {
      expect(services.app?.environment?.[name], name).toMatch(
        new RegExp(`^\\$\\{${name}:-[^}]+\\}$`),
      );
    }
    expect(composeDefaults.NORTHMES_API_RATE_LIMIT).toBe('off');
    // The example's line turns the limits on; its request counts are the defaults.
    expect(commented.NORTHMES_API_RATE_LIMIT).toBe('on');
    expect(commented.NORTHMES_API_RATE_LIMIT_READS).toBe(
      composeDefaults.NORTHMES_API_RATE_LIMIT_READS,
    );
    expect(commented.NORTHMES_API_RATE_LIMIT_WRITES).toBe(
      composeDefaults.NORTHMES_API_RATE_LIMIT_WRITES,
    );
    expect(Number(composeDefaults.NORTHMES_API_RATE_LIMIT_READS)).toBeGreaterThan(0);
    expect(Number(composeDefaults.NORTHMES_API_RATE_LIMIT_WRITES)).toBeGreaterThan(0);
  });

  // A variable that compose.yaml reads from .env with a default has a line in the example, active
  // or commented out, so an operator finds every setting there.
  it('the example .env names every variable that compose.yaml reads with a default', () => {
    const { active, commented } = exampleEnv();

    expect(Object.keys(composeDefaults), 'variables with a default').not.toHaveLength(0);
    for (const name of Object.keys(composeDefaults)) {
      expect(name in active || name in commented, `${name} in deploy/northmes.env.example`).toBe(
        true,
      );
    }
  });

  it('bootstrap, migrate and app reach the bundled db unless NORTHMES_DATABASE_URL names another server', () => {
    for (const name of ['bootstrap', 'migrate', 'app']) {
      expect(services[name]?.environment?.DATABASE_URL, name).toBe(
        // biome-ignore lint/suspicious/noTemplateCurlyInString: Compose reads the placeholder from .env.
        '${NORTHMES_DATABASE_URL:-postgres://db:5432/northmes}',
      );
    }
    expect(services.bootstrap?.environment?.NORTHMES_DB_ADMIN_USER).toBe(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: Compose reads the placeholder from .env.
      '${NORTHMES_DB_ADMIN_USER:-postgres}',
    );
  });

  it('compose.external-db.yaml keeps db from starting and lets bootstrap start without it, and the example .env shows the COMPOSE_FILE line that adds it', () => {
    const externalFile = 'compose.external-db.yaml';
    const external = parse(read(`deploy/${externalFile}`)) as Compose;

    expect(Object.keys(external.services).sort()).toEqual(['bootstrap', 'db']);
    expect(external.services.db?.profiles).toEqual(['bundled-db']);
    expect(external.services.bootstrap?.depends_on?.db).toEqual({
      condition: 'service_healthy',
      required: false,
    });
    // The commented COMPOSE_FILE line lists the main bundle first and the overlay after it, and
    // each file it names is in deploy/.
    const files = exampleEnv().commented.COMPOSE_FILE?.split(':') ?? [];
    expect(files[0]).toBe('compose.yaml');
    expect(files).toContain(externalFile);
    for (const file of files) {
      expect(existsSync(new URL(`../../deploy/${file}`, import.meta.url)), file).toBe(true);
    }
  });

  it('ADR0045 backup starts only under the backup profile, on the pinned Postgres image, and writes to ./backups', () => {
    const backup = services.backup;

    expect(backup?.profiles).toEqual(['backup']);
    expect(backup?.image).toBe(pgImage);
    expect(backup?.command).toEqual(['nightly']);
    expect(backup?.environment?.DATABASE_URL).toBe(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: Compose reads the placeholder from .env.
      '${NORTHMES_DATABASE_URL:-postgres://db:5432/northmes}',
    );
    expect(backup?.volumes).toEqual(
      expect.arrayContaining(['.:/bundle:ro', './backups:/backups', 'caddy-data:/data']),
    );
  });

  // backup.sh deletes a backup older than N days, which keeps N + 1 nightly backups, and the example
  // .env tells the operator how many days are kept.
  it('ADR0045 backup.sh keeps the days of backups that the example .env promises', () => {
    const olderThan = /-mtime \+(\d+) -delete/.exec(read('deploy/backup.sh'))?.[1];
    const promised = /kept (\d+) days/.exec(read('deploy/northmes.env.example'))?.[1];

    expect(olderThan, 'a find -mtime +N -delete in deploy/backup.sh').toBeDefined();
    expect(promised, 'a "kept N days" in deploy/northmes.env.example').toBeDefined();
    expect(Number(olderThan) + 1).toBe(Number(promised));
  });

  it('ADR0045 the example .env turns the backup profile on for the bundled db, and the own-Postgres lines turn it off', () => {
    const { active, commented } = exampleEnv();

    expect(active.COMPOSE_PROFILES?.split(',')).toContain('backup');
    expect(commented.COMPOSE_PROFILES).toBe('');
  });

  it('the example .env holds the version line and no secret', () => {
    const lines = read('deploy/northmes.env.example')
      .split('\n')
      .filter((line) => line && !line.startsWith('#'));

    expect(lines.some((line) => /^NORTHMES_VERSION=\d+\.\d+\.\d+/.test(line))).toBe(true);
    expect(lines.filter((line) => /PASSWORD|SECRET|TOKEN/.test(line))).toEqual([]);
  });
});

describe('release-please (ADR 0080 changes ADR 0038)', () => {
  it('starts at 0.0.1 with one root component', () => {
    const config = JSON.parse(read('release-please-config.json')) as {
      packages: Record<string, { 'initial-version'?: string; 'release-type'?: string }>;
    };

    expect(Object.keys(config.packages)).toEqual(['.']);
    expect(config.packages['.']?.['initial-version']).toBe('0.0.1');
    expect(config.packages['.']?.['release-type']).toBe('node');
  });
});
