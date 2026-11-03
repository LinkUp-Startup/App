# Multi-stage build for the LinkUp website (Next.js standalone server). The node:alpine images are multi-arch,
# so the same file builds on the ARM64 VPS (Dokploy builds there natively) and on x86-64 laptops.
# Build context is the repo root, because the build type-checks against the API contract in shared/:
#   docker build -f web/Dockerfile -t linkup-web .

FROM node:22-alpine AS build
WORKDIR /repo/web
ENV NEXT_TELEMETRY_DISABLED=1

# Install first so this layer is cached until the lockfile changes.
COPY web/package.json web/package-lock.json web/.npmrc ./
RUN npm ci --ignore-scripts

COPY shared/ /repo/shared/
COPY web/ ./
# public/ is empty for now and git doesn't keep empty folders; the runtime stage copies it.
RUN mkdir -p public && npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# output: 'standalone' traces only the files the server needs; static assets are copied next to it.
COPY --from=build --chown=node:node /repo/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/web/.next/static ./.next/static
COPY --from=build --chown=node:node /repo/web/public ./public

# The node image ships a non-root "node" user; never run as root.
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD wget -qO /dev/null http://127.0.0.1:3000/ || exit 1

CMD ["node", "server.js"]
