FROM oven/bun:1 AS base

WORKDIR /app

# Install dependencies using Bun workspaces
# Copy lockfile and root manifest first to maximize layer caching
COPY bun.lock package.json ./

# Copy workspace manifests so Bun can resolve workspace:* deps
COPY packages/core/package.json ./packages/core/package.json
COPY packages/infra/package.json ./packages/infra/package.json
COPY packages/http/package.json ./packages/http/package.json
COPY packages/cli/package.json ./packages/cli/package.json

RUN bun install --frozen-lockfile

# ---- Runtime image ----
FROM oven/bun:1 AS runtime

WORKDIR /app

# Copy dependency tree from base image
COPY --from=base /app/bun.lock ./bun.lock
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/node_modules ./node_modules

# Copy workspace code
COPY packages ./packages

# Environment configuration
# NODE_ENV should be production for both staging and production deployments
ENV NODE_ENV=production

# Optional logical environment; override from CI/CD or docker run:
#   - APP_ENV=staging
#   - APP_ENV=production
ARG APP_ENV=staging
ENV APP_ENV=${APP_ENV}

# Default HTTP port (actual value can be overridden with PORT env var)
EXPOSE 3000

# Start the Bun HTTP server
# This matches TEST_HTTP_ENDPOINT.md:
#   bun packages/http/src/index.ts
CMD ["bun", "packages/http/src/index.ts"]


