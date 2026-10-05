---
status: "accepted"
date: 2026-10-05
decision-makers: Krister Johansson
consulted: internal research notes 01, 15, 19 and 32
informed: contributors, coding agents and pilot IT
release: "1"
needs-confirmation: "pilot IT (TLS option, bind address)"
---

# On-prem deployment with Docker Compose and mandatory TLS

## Context and problem statement

Krister Johansson decided that the pilot runs on-prem on one Linux host with Docker Compose, with one NorthMES process in role `all`, built by one developer with coding agents. One installation serves one customer. The plant may have no internet access and no public DNS name. Stations need a secure context: the station cookie is `__Host-` prefixed and `Secure`, and the shell's manifest hash check uses `crypto.subtle`, which browsers expose only on secure origins. Over plain HTTP on a LAN address the hash check failed every remote in the spike (internal research note 19).

This ADR records the Compose bundle, its services and rules, the site files a release never overwrites, and the TLS rules. It covers `compose.yaml`, the vendor `Caddyfile`, `northmes.env`, the install guide and the scripts that ship in the release bundle. Backups and upgrades are in [ADR 0045](0045-backups-restore-drills-upgrades-and-rollback.md), secrets in [ADR 0047](0047-secrets-and-the-installation-key.md).

## Decision drivers

* Krister Johansson's decision: one Linux host, Docker Compose, role `all`, one developer operating it.
* Every browser, planner and station alike, needs a secure context.
* A plant without internet must install and run: no image pull at start, no CDN call from the browser.
* A release must never overwrite what the site changed.
* After a host reboot, Docker restarts containers by restart policy, all at once, and Compose's `depends_on` does not apply.

## Considered options

* Docker Compose with Caddy in front and mandatory HTTPS from the customer's CA or Caddy's internal CA
* Docker Compose with plain HTTP and the browser policy that treats a listed HTTP origin as secure
* Kubernetes with a Helm chart
* Docker Compose with Traefik or nginx in front

## Decision outcome

Chosen option: "Docker Compose with Caddy in front and mandatory HTTPS from the customer's CA or Caddy's internal CA", because it is the smallest setup that gives every browser a secure context on a plant LAN without public DNS, runs offline, and needs no Docker socket.

### Services

| Service | Image | Does | Rules |
|---|---|---|---|
| `caddy` | `caddy`, pinned by digest | TLS, reverse proxy, compression, maintenance page | Static Caddyfile that imports a site snippet; no Docker socket; publishes 443 and 80 on `NORTHMES_BIND_IP` only; `encode zstd gzip`; `handle_errors 502 503 504` serves the maintenance page with status 503 and `Retry-After: 15`; `depends_on: app` with `service_started`; `stream_close_delay` keeps WebSockets open across a reload |
| `app` | `ghcr.io/northmes/northmes:<version>@sha256:<digest>`, or the site image built from it | Role `all` | `init: true`; `stop_grace_period: 45s`; a `mem_limit`; `read_only: true` with a tmpfs for `/tmp`; `cap_drop: [ALL]`; `no-new-privileges`; non-root user; healthcheck through a Node script that fetches `/health/ready`; retries the database at boot |
| `migrate` | the same image as `app` | `northmes migrate` and the admin CLI commands | `restart: "no"`; `install.sh` and `upgrade.sh` run it explicitly with `docker compose run --rm migrate` |
| `db` | `ghcr.io/northmes/postgres@sha256:<digest>` ([ADR 0005](0005-postgres-18-official-image-with-pgbackrest-timescaledb-deferred.md)) | Postgres 18 with pgBackRest | Publishes no port; a `mem_limit`; a `stop_grace_period` longer than app's; healthcheck `pg_isready` |

Rules for every service:

* Images pinned by digest, `pull_policy: missing`, and the `local` log driver, which rotates; the default `json-file` driver does not.
* Only Caddy publishes ports. Docker routes published ports before ufw's chains, so a published database port would bypass the host firewall. Network ACLs belong to customer IT; `DOCKER-USER` rules are optional.
* The app reports not ready until the database answers and the schema is compatible ([ADR 0043](0043-health-endpoints-graceful-shutdown-and-the-system-health-page.md)); the scripts run `migrate` explicitly instead of relying on `depends_on`.
* Profiles: `observability` for a debugging session ([ADR 0046](0046-observability-structured-logs-host-checks-and-optional-opentelemetry.md)); `mail` starts Mailpit on test installs only.
* No Helm chart, no Kubernetes and no PgBouncer in release 1. The code still follows the multi-replica rules ([ADR 0002](0002-modular-monolith-with-module-owned-schemas-and-process-roles.md)).
* All frontend assets and fonts are bundled. The shell makes no CDN call.
* The install guide tells the customer that the host is the single point of failure and that recovery is a restart plus a restore.

The release bundle is a tarball attached to the GitHub release, because `docker compose publish` cannot ship a Compose app with bind mounts: `compose.yaml`, the vendor `Caddyfile`, `northmes.env.example`, the scripts, the systemd units and a release manifest ([ADR 0050](0050-github-organization-rulesets-ci-runners-and-supply-chain.md) covers the offline image bundle).

### Site files

* `compose.override.yaml`, which Compose merges automatically, holds the site's Compose changes.
* `northmes.env` holds infrastructure settings only: `NORTHMES_PUBLIC_ORIGIN`, `NORTHMES_BIND_IP`, database URLs, proxy variables and the optional OpenTelemetry endpoint. Behaviour switches are audited settings ([ADR 0022](0022-shared-building-blocks-packages-the-master-data-kit-settings-and-generators.md)).
* A site Caddyfile snippet holds the host name and the TLS choice; the vendor Caddyfile imports it.
* `pgbackrest.conf` is a site file ([ADR 0045](0045-backups-restore-drills-upgrades-and-rollback.md)).
* Plugins reach the pilot as a site image `FROM ghcr.io/northmes/northmes:<version>`, tagged per upgrade ([ADR 0037](0037-plugins-drop-in-packages-command-validators-and-ui-slots.md)).
* The N-1 images stay on the host by tag, and the previous bundle's `compose.yaml` and Caddyfile are kept.

### TLS

| Option | When | What the site does |
|---|---|---|
| The customer's own CA (preferred) | The customer runs a CA whose root its PCs already trust | The CA issues a certificate for a name in the customer's internal DNS; Caddy reads it from `./certs`; renewal is manual |
| Caddy's internal CA (fallback) | No customer CA | Caddy runs `tls internal` with `skip_install_trust`; customer IT deploys the root from the `caddy_data` volume to every PC, for example by Group Policy or Intune |

* Plain HTTP is never served. A catch-all `http://` block redirects any host to the canonical HTTPS host with status 308. A browser policy that treats an HTTP origin as secure is not a supported setup.
* A public name with the ACME DNS-01 challenge needs a Caddy build with a DNS provider module, outbound internet and DNS credentials; it is not in the release 1 install guide.
* Names come from the customer's internal DNS. `.local` names are reserved for multicast DNS and are not used.
* HSTS is switched on only after the pilot's certificates are confirmed.
* The `caddy_data` volume is backed up; with the internal CA, losing it means a new root on every PC, and the root key goes into the escrow ([ADR 0047](0047-secrets-and-the-installation-key.md)).
* The internal CA issues leaf certificates valid for 12 hours with `NotBefore` set to the issue time, so every station syncs its clock to the plant NTP source.
* `scripts/rotate-cert.sh` checks that key and certificate match, the SAN and the chain, copies the files atomically, runs `caddy reload --force` and confirms that the served `notAfter` changed. The app warns 30 days before expiry.
* The first shell script checks `isSecureContext` before sign-in and shows a plain message on an insecure origin.
* Outbound TLS: `NODE_EXTRA_CA_CERTS` points at the `customer_ca` secret, so the Pyramid web services, an SMTP relay or a TLS-inspecting proxy with the customer's CA verify.

### Consequences

* Good, because one Compose file and one set of digests serve every install, online or offline.
* Good, because Caddy handles WebSocket, SSE, HTTP/2 and an internal CA without extra configuration and without the Docker socket (internal research note 15).
* Good, because site changes survive every upgrade and a rollback finds the previous images and bundle on the host.
* Bad, because the host is a single point of failure; the pilot accepts restart plus restore as recovery.
* Bad, because the customer renews certificates by hand with its own CA, or deploys a root to every PC with the internal CA.
* Bad, because an upgrade stops the one app replica; stations and planners see the maintenance page meanwhile ([ADR 0045](0045-backups-restore-drills-upgrades-and-rollback.md)).

### Confirmation

* Compose contract test (Vitest) over `docker compose config --format json`: every image carries a digest; every service has `pull_policy: missing` and the `local` log driver; only `caddy` publishes ports, bound to `NORTHMES_BIND_IP`; `app` has `init: true`, `stop_grace_period` 45 s, `read_only`, `cap_drop: [ALL]`; `db` has a longer `stop_grace_period` than `app`; no service mounts the Docker socket.
* Nightly Compose stack test with Testcontainers' `DockerComposeEnvironment`: `/health/ready` returns 200 through Caddy; with `app` stopped, `GET /` through Caddy returns the maintenance page with 503 and `Retry-After: 15`; `GET http://<host-ip>/` returns 308 to the canonical HTTPS host.
* Nightly bind test with two networks: a client in the subnet that is not allowed times out on 443.
* Site files test: install a 0.1.0 fixture, edit the site snippet, upgrade to a 0.2.0 fixture; the snippet is unchanged and the 0.1.0 images are still present; a rollback starts the previous site image.
* Certificate test: after `rotate-cert.sh`, the `notAfter` that Caddy serves has changed.
* Playwright: the shell on an insecure origin shows the secure-context message before sign-in; a spec over the main routes fails on any request to another origin.

## Pros and cons of the options

### Compose with Caddy and mandatory HTTPS

* Good, because the customer's CA covers PCs that already trust it, and the internal CA covers plants without one.
* Bad, because NorthMES supports two certificate paths in the install guide.

### Compose with plain HTTP and the secure-origin browser policy

* Good, because no certificate work is needed.
* Bad, because passwords cross the LAN in clear text and cookies cannot be `Secure` (internal research note 15).
* Bad, because every PC needs the policy, and a PC without it fails every remote hash check.

### Kubernetes with a Helm chart

* Good, because it gives restarts on failed probes and rolling updates.
* Bad, because the pilot has one host and one developer, and Helm values wait for a hosting partner that asks for them.

### Traefik or nginx in front

* Good, because both are widely used reverse proxies.
* Bad, because Traefik's Docker provider needs the Docker socket and Docker 29 broke older Traefik releases, and nginx needs explicit WebSocket and buffering settings and has no internal CA (internal research note 15).

## More information

* Related ADRs: [0002](0002-modular-monolith-with-module-owned-schemas-and-process-roles.md) process roles, [0005](0005-postgres-18-official-image-with-pgbackrest-timescaledb-deferred.md) database image, [0011](0011-principals-credentials-and-same-origin-rules.md) public origin and cookies, [0019](0019-web-shell-with-react-module-federation-remotes.md) manifest hash check, [0033](0033-online-operator-station-in-the-production-start-module.md) station network, [0037](0037-plugins-drop-in-packages-command-validators-and-ui-slots.md) site image, [0043](0043-health-endpoints-graceful-shutdown-and-the-system-health-page.md) health and watchdog, [0045](0045-backups-restore-drills-upgrades-and-rollback.md) backups and upgrades, [0046](0046-observability-structured-logs-host-checks-and-optional-opentelemetry.md) host checks, [0047](0047-secrets-and-the-installation-key.md) secrets, [0050](0050-github-organization-rulesets-ci-runners-and-supply-chain.md) offline image bundle.
* Plan: [12 operations and security](../plan/12-operations-and-security.md) (the pilot shape, the Compose bundle, TLS, host, disks and network, go-live checklist), [16 open questions](../plan/16-open-questions.md).
* Pilot IT confirms the TLS option and certificate issuer, the bind address and the plant network ranges before go-live.
* Caddy automatic HTTPS and the internal CA: https://caddyserver.com/docs/automatic-https
* Docker and firewalls: https://docs.docker.com/engine/network/packet-filtering-firewalls/
* Compose services reference: https://docs.docker.com/reference/compose-file/services/
* The `local` log driver: https://docs.docker.com/engine/logging/drivers/local/
* Multicast DNS and `.local` (RFC 6762): https://www.rfc-editor.org/rfc/rfc6762
* Revisit when a second replica runs, when a hosting partner asks for Helm values, or when a customer wants a public name with ACME.
