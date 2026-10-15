# The NorthMES image (ADR 0080, ADR 0044): one image that runs the server, migrate and the other
# CLI commands. `northmes serve` is the default; Compose runs `northmes db bootstrap` and
# `northmes migrate` from the same image.

FROM node:26-trixie-slim@sha256:0d1e33586362bb9e608c4e751e7a9e7edb55c9ac11461ed5666af696cc461dd4 AS build
RUN npm install --global pnpm@12.6.0
WORKDIR /src
COPY . .
# The workspace packages take zod and Nest as peers from their dev dependencies, so the image keeps
# the full install. A slimmer image (pnpm deploy) is a later change.
RUN pnpm install --frozen-lockfile && pnpm build

FROM node:26-trixie-slim@sha256:0d1e33586362bb9e608c4e751e7a9e7edb55c9ac11461ed5666af696cc461dd4
LABEL org.opencontainers.image.source="https://github.com/northMES/northmes" \
  org.opencontainers.image.licenses="AGPL-3.0-or-later" \
  org.opencontainers.image.title="NorthMES"
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /src /app
COPY deploy/northmes /usr/local/bin/northmes
USER node
ENTRYPOINT ["northmes"]
CMD ["serve"]
