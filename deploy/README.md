# Run NorthMES with Docker Compose

This folder is everything a host needs: `compose.yaml`, `Caddyfile`, `backup.sh` and `northmes.env.example`. It runs these services:

| Service | What it does |
|---|---|
| `db` | Postgres 18, with its data in the `db-data` volume |
| `bootstrap` | Creates the database roles, then exits. A second run changes nothing |
| `migrate` | Applies the pending migrations, then exits. `app` starts only after it exits 0 |
| `app` | NorthMES: the API and the web app, on the Compose network only |
| `caddy` | HTTPS on port 443 with Caddy's own certificate authority, and a redirect from port 80 |
| `backup` | Every night, writes the database and the site's files to `./backups`. Starts only when `.env` turns it on |

There is no offline install yet.

## Install

You need Docker Engine with Compose, and ports 80 and 443 free on the host.

1. Copy this folder to the host and go into it.
2. Create `.env` and set the host name browsers will use:

   ```sh
   cp northmes.env.example .env
   ```

   Set `NORTHMES_VERSION` to the line in the release notes, for example `NORTHMES_VERSION=0.0.1@sha256:...`. The digest pins the exact image.

3. Create the secret files. With a Postgres server of your own, read [Use your own Postgres](#use-your-own-postgres) first. Each holds one random value, readable only by the user the NorthMES image runs as (uid 1000):

   ```sh
   mkdir -p secrets
   for name in postgres_password db_owner_password db_app_password db_auth_password auth_secret; do
     openssl rand -hex 32 > "secrets/$name"
   done
   sudo chown 1000:1000 secrets/*
   chmod 600 secrets/*
   mkdir backups
   ```

4. Start it:

   ```sh
   docker compose up -d
   ```

5. Create your company and its first admin. The command prints a temporary password once:

   ```sh
   docker compose run --rm app company create --name "Your company" \
     --admin-username admin --admin-email admin@example.com --reason "first install"
   ```

6. Open `https://<NORTHMES_HOST>/sign-in` and sign in with the email and the temporary password. NorthMES asks for a new password.

The browser warns about the certificate, because Caddy signed it with its own authority. To trust it, copy Caddy's root certificate out of the container and add it to the computers that use NorthMES:

```sh
docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt ./northmes-root.crt
```

## Use your own Postgres

NorthMES can use a Postgres 18 server you already run, next to the other databases on it, in place of the `db` service. Do this at install, before the first `docker compose up -d`.

1. On that server, create a database for NorthMES and an admin role that may create roles and owns the database. A managed service's admin role already has `CREATEROLE`:

   ```sql
   create role northmes_admin login createrole password '<the admin password>';
   create database northmes owner northmes_admin;
   ```

2. In `.env`, select `compose.external-db.yaml`, which keeps `db` from starting, and name the server, the database and the admin:

   ```sh
   COMPOSE_FILE=compose.yaml:compose.external-db.yaml
   NORTHMES_DATABASE_URL=postgres://pg.example.com:5432/northmes?sslmode=verify-full
   NORTHMES_DB_ADMIN_USER=northmes_admin
   ```

   The URL never holds a user or a password: NorthMES refuses one that does. Keep `sslmode=verify-full`: it encrypts the connection and checks the server's certificate against the public certificate authorities, so the server must offer TLS. Use a direct connection, not a pooler in transaction mode, because migrations hold a session lock.

3. Put the admin's password in `secrets/postgres_password` instead of a random value. Create the other secret files as in [Install](#install).

`bootstrap` logs in as the admin and creates the roles NorthMES runs as: `nm_owner` for migrations, `nm_app` and `nm_auth` for the app, and `nm_ext`, with the passwords in `secrets/`. `bootstrap` runs on every `docker compose up -d` and changes nothing once the roles are in place, so keep the admin's password in its file. Role names are shared by every database on a server, so one server holds one NorthMES installation.

## Back up

Your backups are yours to keep, as with any self-hosted app. NorthMES writes them on the host; copying them somewhere safe is up to you.

`northmes.env.example` turns the `backup` service on with `COMPOSE_PROFILES=backup`. Every night at 02:00 UTC it writes three files to `./backups`, named by the time of the backup, and deletes those older than 7 days:

| File | What it holds |
|---|---|
| `northmes-<time>.dump` | The database, from `pg_dump -Fc` |
| `northmes-<time>-roles.sql` | The database roles without their passwords, from `pg_dumpall --roles-only` |
| `northmes-<time>-files.tar.gz` | `secrets/`, `.env`, `compose.override.yaml` and Caddy's data with its certificate authority |

The files are readable only by the owner of the `backups` folder, because they hold personal data and every secret of the installation. `backup.sh` is the whole procedure. To take a backup now:

```sh
docker compose run --rm backup now
```

What stays yours:

- Copy `./backups` off the host every day, for example with `rsync` or your backup software, and encrypt that copy.
- Keep the copies as long as your plant needs; the host keeps 7 days.
- Restore a backup on another machine now and then, to know that it works.

With [your own Postgres](#use-your-own-postgres), your provider backs the database up: Azure Database for PostgreSQL, for example, keeps 7 to 35 days with point-in-time restore. Comment out `COMPOSE_PROFILES=backup` in `.env`, and back up `secrets/`, `.env` and `compose.override.yaml` with the rest of the host. To also keep a dump of your own, leave the profile on: `backup` then dumps the server in `NORTHMES_DATABASE_URL` as `NORTHMES_DB_ADMIN_USER`. That role must read every row past row-level security, so it needs `BYPASSRLS` and the `pg_read_all_data` role, which not every provider grants. `backup` always connects with `sslmode=verify-full`, whatever the URL says, and checks the server's certificate against the root certificate you put in `db-root.crt` in this folder; for Azure, that is the root certificate that Azure's TLS documentation names.

## Restore

To restore onto a new host, or after losing the `db-data` volume:

1. Copy this folder to the host as in [Install](#install), without creating `.env` or `secrets/`, and copy your backups into `backups/`.
2. Put back `secrets/`, `.env` and `compose.override.yaml` from the backup you restore, keeping their owners:

   ```sh
   sudo tar -xzf backups/northmes-<time>-files.tar.gz --exclude=data
   ```

3. Create the database roles, then restore the roles NorthMES's modules own, the database and Caddy's data:

   ```sh
   docker compose run --rm bootstrap
   docker compose run --rm backup restore <time>
   ```

4. Start NorthMES. `migrate` applies nothing when the image is the one the backup was taken with:

   ```sh
   docker compose up -d
   ```

`pg_restore` runs in one transaction, so a restore that fails leaves an empty database. CI runs these steps on every pull request (`scripts/ci/backup-restore.sh`).

With your own Postgres, restore the server with your provider's tools instead, for example Azure's point-in-time restore, which creates a new server. Put the new server's host name in `NORTHMES_DATABASE_URL` in `.env` and run `docker compose up -d`.

## Upgrade

1. Read the release notes. They give the new `NORTHMES_VERSION` line.
2. Take a backup, so you can go back across the release's migrations. With your own Postgres, take your provider's on-demand backup instead:

   ```sh
   docker compose run --rm backup now
   ```

3. Put the new line in `.env` in place of the old one.
4. Run:

   ```sh
   docker compose pull
   docker compose down
   docker compose up -d
   ```

`migrate` prints each migration it applies. If it fails, `app` does not start: `docker compose logs migrate` shows why.

## Go back

Put the previous `NORTHMES_VERSION` line back in `.env` and run `docker compose down` and `docker compose up -d`. This works while the newer release added no migration; the release notes say so.

When it added a migration, going back means restoring the backup you took before the upgrade, which loses what was written since. Put the previous `NORTHMES_VERSION` line back in `.env`, remove the database volume and restore:

```sh
docker compose down
docker volume rm northmes_db-data
docker compose run --rm bootstrap
docker compose run --rm backup restore <time>
docker compose up -d
```

## Files that stay yours

`.env`, `secrets/`, `backups/`, `db-root.crt` and a `compose.override.yaml` you add are never part of a release, so copying a newer bundle over this folder keeps them.
