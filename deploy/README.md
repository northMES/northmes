# Run NorthMES with Docker Compose

This folder is everything a host needs: `compose.yaml`, `Caddyfile` and `northmes.env.example`. It runs five services:

| Service | What it does |
|---|---|
| `db` | Postgres 18, with its data in the `db-data` volume |
| `bootstrap` | Creates the database roles, then exits. A second run changes nothing |
| `migrate` | Applies the pending migrations, then exits. `app` starts only after it exits 0 |
| `app` | NorthMES: the API and the web app, on the Compose network only |
| `caddy` | HTTPS on port 443 with Caddy's own certificate authority, and a redirect from port 80 |

This is the v0.0.1 bundle: no backups and no offline install yet. Do not keep production data in it.

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

   The URL never holds a user or a password: NorthMES refuses one that does. `sslmode=verify-full` checks the server's certificate against the public certificate authorities; drop it only for a server that does not offer TLS. Use a direct connection, not a pooler in transaction mode, because migrations hold a session lock.

3. Put the admin's password in `secrets/postgres_password` instead of a random value. Create the other secret files as in [Install](#install).

`bootstrap` logs in as the admin and creates the roles NorthMES runs as: `nm_owner` for migrations, `nm_app` and `nm_auth` for the app, and `nm_ext`, with the passwords in `secrets/`. `bootstrap` runs on every `docker compose up -d` and changes nothing once the roles are in place, so keep the admin's password in its file. Role names are shared by every database on a server, so one server holds one NorthMES installation.

## Upgrade

1. Read the release notes. They give the new `NORTHMES_VERSION` line.
2. Put that line in `.env` in place of the old one.
3. Run:

   ```sh
   docker compose pull
   docker compose down
   docker compose up -d
   ```

`migrate` prints each migration it applies. If it fails, `app` does not start: `docker compose logs migrate` shows why.

## Go back

Put the previous `NORTHMES_VERSION` line back in `.env` and run `docker compose down` and `docker compose up -d`. This works while the newer release added no migration; the release notes say so.

## Files that stay yours

`.env`, `secrets/` and a `compose.override.yaml` you add are never part of a release, so copying a newer bundle over this folder keeps them.
