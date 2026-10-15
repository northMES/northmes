import { readFileSync } from 'node:fs';
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

  it('compose.external-db.yaml keeps db from starting and lets bootstrap start without it', () => {
    const external = parse(read('deploy/compose.external-db.yaml')) as Compose;

    expect(Object.keys(external.services).sort()).toEqual(['bootstrap', 'db']);
    expect(external.services.db?.profiles).toEqual(['bundled-db']);
    expect(external.services.bootstrap?.depends_on?.db).toEqual({
      condition: 'service_healthy',
      required: false,
    });
    expect(read('deploy/northmes.env.example')).toContain(
      '# COMPOSE_FILE=compose.yaml:compose.external-db.yaml',
    );
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
    expect(read('deploy/backup.sh')).toContain('-mtime +6 -delete');
  });

  it('ADR0045 the example .env turns the backup profile on for the bundled db, and the own-Postgres lines turn it off', () => {
    const example = read('deploy/northmes.env.example');

    expect(example.split('\n')).toContain('COMPOSE_PROFILES=backup');
    expect(example).toContain('# COMPOSE_PROFILES=');
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
