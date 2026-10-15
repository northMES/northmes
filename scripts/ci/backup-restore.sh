#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-or-later
# SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
# Ops / backup restore (ADR 0045): runs the "Back up" and "Restore" steps of deploy/README.md on the
# Compose bundle, with the NorthMES image tagged ghcr.io/northmes/northmes:ci. It installs, creates a
# company, takes a backup, throws the installation away with its volumes, restores the backup into
# a fresh folder, and checks that every table holds the rows it held, that Caddy keeps its
# certificate authority and that the admin signs in.
set -eu

work="$(mktemp -d)"
# Every exit, passed or failed, removes the stack, its volumes and the folders with their secrets.
trap 'docker compose --project-name northmes down --volumes >/dev/null 2>&1; sudo rm -rf "$work"' EXIT
repo="$(pwd)"
names="postgres_password db_owner_password db_app_password db_auth_password auth_secret"

# The rows of every table, one "schema.table count" line each, read as the superuser past
# row-level security.
counts() {
  docker compose exec -T db psql --username=postgres --dbname=northmes -At -c "
    select format('%s.%s %s', table_schema, table_name,
      (xpath('/row/c/text()', query_to_xml(
        format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1])
    from information_schema.tables
    where table_type = 'BASE TABLE' and table_schema not in ('pg_catalog', 'information_schema')
    order by 1"
}

wait_for_sign_in_page() {
  for _ in $(seq 60); do
    if curl -fsk -o /dev/null https://localhost/sign-in; then return 0; fi
    sleep 2
  done
  docker compose logs
  echo "NorthMES did not answer on https://localhost/sign-in" >&2
  return 1
}

echo "== install"
cp -R deploy "$work/site"
cd "$work/site"
sed 's/^NORTHMES_VERSION=.*/NORTHMES_VERSION=ci/' northmes.env.example > .env
mkdir secrets backups
for name in $names; do openssl rand -hex 32 > "secrets/$name"; done
sudo chown 1000:1000 secrets/*
sudo chmod 600 secrets/*
docker compose up -d
wait_for_sign_in_page
docker compose ps backup --format '{{.State}}' | grep -qx running
docker compose run --rm app company create --name "Backup check" --admin-username admin \
  --admin-email admin@example.com --reason "backup restore check" | tee "$work/company.txt"
password="$(sed -n 's/^Temporary password: //p' "$work/company.txt")"
docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt "$work/root-before.crt"

echo "== back up"
docker compose stop app
counts > "$work/counts-before.txt"
docker compose run --rm backup now
ls -l backups
test "$(find backups -type f | wc -l)" -eq 3
test -z "$(find backups -type f ! -perm 600)"
test -z "$(find backups -type f ! -user "$(id -u)")"
stamp="$(find backups -name 'northmes-*.dump' | sed 's#^backups/northmes-\(.*\)\.dump$#\1#')"

echo "== lose the host"
mv backups "$work/copied-off-host"
docker compose down --volumes
cd "$work"
sudo rm -rf site

echo "== restore"
cp -R "$repo/deploy" "$work/restored"
cd "$work/restored"
mv "$work/copied-off-host" backups
sudo tar -xzf "backups/northmes-$stamp-files.tar.gz" --exclude=data
test "$(stat -c %u secrets/auth_secret)" -eq 1000
docker compose run --rm bootstrap
docker compose run --rm backup restore "$stamp"
counts > "$work/counts-after.txt"
diff "$work/counts-before.txt" "$work/counts-after.txt"
grep -q '^core\.' "$work/counts-after.txt"
docker compose up -d
wait_for_sign_in_page
docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt "$work/root-after.crt"
cmp "$work/root-before.crt" "$work/root-after.crt"
curl -fsk -o /dev/null -H 'Origin: https://localhost' -H 'Content-Type: application/json' \
  --data "{\"email\":\"admin@example.com\",\"password\":\"$password\"}" \
  https://localhost/api/auth/sign-in/email

echo "== restored backup northmes-$stamp: $(wc -l < "$work/counts-after.txt") tables match"
