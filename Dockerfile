# The NorthMES image (ADR 0080, ADR 0044): one image that runs the server, migrate and the other
# CLI commands. `northmes serve` is the default; Compose runs `northmes db bootstrap` and
# `northmes migrate` from the same image.

FROM node:26-trixie-slim@sha256:0d1e33586362bb9e608c4e751e7a9e7edb55c9ac11461ed5666af696cc461dd4 AS build
# npm ci installs pnpm from deploy/pnpm's lockfile, which pins the integrity of every package it
# downloads. Keep its version equal to packageManager in package.json.
COPY deploy/pnpm/package.json deploy/pnpm/package-lock.json /opt/pnpm/
RUN npm ci --prefix /opt/pnpm --no-audit --no-fund && ln -s /opt/pnpm/node_modules/.bin/pnpm /usr/local/bin/pnpm
WORKDIR /src
COPY . .
# The workspace packages take zod and Nest as peers from their dev dependencies, so the image keeps
# the full install. A slimmer image (pnpm deploy) is a later change. turbo's cache and task logs hold
# how long each task took and pnpm's install state holds when the install ran, so the build removes
# them and two builds of one commit give the same image (reproducible.yml).
RUN pnpm install --frozen-lockfile && pnpm build \
  && find . -name node_modules -prune -o -name .turbo -type d -prune -exec rm -rf {} + \
  && rm -f node_modules/.modules.yaml node_modules/.pnpm-workspace-state-v1.json

FROM node:26-trixie-slim@sha256:0d1e33586362bb9e608c4e751e7a9e7edb55c9ac11461ed5666af696cc461dd4
LABEL org.opencontainers.image.source="https://github.com/northMES/northmes" \
  org.opencontainers.image.licenses="AGPL-3.0-or-later" \
  org.opencontainers.image.title="NorthMES"
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /src /app
COPY --chmod=755 deploy/northmes /usr/local/bin/northmes
USER node
ENTRYPOINT ["northmes"]
CMD ["serve"]
