#!/bin/sh
# The backup service of compose.yaml (ADR 0045). README.md, "Back up" and "Restore", has the steps.
#
#   nightly         take a backup at 02:00 UTC every night, the service's default
#   now             take one backup and exit: docker compose run --rm backup now
#   restore STAMP   restore backups/northmes-STAMP-*: the roles, the database and Caddy's data
#
# A backup is three files in ./backups, readable only by the owner of that folder: the database
# roles without their passwords (pg_dumpall --roles-only), the database (pg_dump -Fc), and a tar of
# secrets/, .env, compose.override.yaml and Caddy's data. Backups older than 7 days are deleted.
set -eu

# The admin's password and the whole database cross this connection, so a server other than the
# bundled db must be reached with a verified certificate.
case "$DATABASE_URL" in
  postgres://db:5432/*) ;;
  *sslmode=verify-full*) ;;
  *)
    echo "NORTHMES_DATABASE_URL must hold sslmode=verify-full for backup to use it" >&2
    exit 1
    ;;
esac

export PGPASSWORD="$(cat /run/secrets/postgres_password)"
login="--username=${NORTHMES_DB_ADMIN_USER}"

backup() {
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  out="/backups/northmes-${stamp}"
  umask 077
  # A failed step leaves no partial file behind. The older backups stay: retention runs only
  # after a backup succeeds, so failing backups never delete the last good ones.
  trap 'rm -f "${out}"*.partial' EXIT
  pg_dumpall "--dbname=${DATABASE_URL}" "$login" --roles-only --no-role-passwords --file="${out}-roles.sql.partial"
  pg_dump "--dbname=${DATABASE_URL}" "$login" --format=custom --file="${out}.dump.partial"
  files="secrets .env"
  [ -e /bundle/compose.override.yaml ] && files="$files compose.override.yaml"
  # shellcheck disable=SC2086 # files is a list of names without spaces.
  tar -czf "${out}-files.tar.gz.partial" -C /bundle $files -C / data
  for part in "${out}"*.partial; do
    chown "$(stat -c %u:%g /backups)" "$part"
    mv "$part" "${part%.partial}"
  done
  find /backups -maxdepth 1 -name 'northmes-*' -mtime +6 -delete
  echo "backup northmes-${stamp} written"
}

case "${1:-}" in
  now)
    backup
    ;;
  nightly)
    while true; do
      next="$(date -u -d 02:00 +%s)"
      [ "$next" -gt "$(date +%s)" ] || next="$(date -u -d 'tomorrow 02:00' +%s)"
      sleep "$((next - $(date +%s)))"
      # A shell of its own keeps set -e, so a failed step stops that backup and not the service.
      sh "$0" now || echo "backup failed, next try tomorrow at 02:00 UTC" >&2
    done
    ;;
  restore)
    in="/backups/northmes-${2:?name the backup to restore, as in: restore 20261015T020000Z}"
    # bootstrap created some of the roles already, so their CREATE ROLE lines are left out and
    # any other error stops the restore.
    psql "--dbname=${DATABASE_URL}" "$login" -At \
      -c 'select format($$CREATE ROLE %s;$$, quote_ident(rolname)) from pg_roles' > /tmp/existing
    grep -vxF -f /tmp/existing "${in}-roles.sql" |
      psql "--dbname=${DATABASE_URL}" "$login" --quiet -v ON_ERROR_STOP=1
    pg_restore "--dbname=${DATABASE_URL}" "$login" --exit-on-error --single-transaction "${in}.dump"
    tar -xzf "${in}-files.tar.gz" -C / data
    echo "restored northmes-${2}"
    ;;
  *)
    echo "usage: nightly | now | restore STAMP" >&2
    exit 2
    ;;
esac
