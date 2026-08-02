# PriceScout — one image serving the API and the built PWA on one port.
#
#   docker build -t pricescout .
#   docker run -p 4000:4000 -v pricescout-data:/data \
#     -e JWT_SECRET=$(openssl rand -hex 32) \
#     -e PRICE_PROVIDERS=serpapi -e SERPAPI_KEY=... pricescout

# ---- build ----------------------------------------------------------------
FROM node:22-slim AS build

WORKDIR /app

# better-sqlite3 falls back to compiling from source when no prebuilt binary
# matches; these are only needed here, not at runtime.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci

COPY . .
RUN npm run build \
  && npm prune --omit=dev

# ---- runtime --------------------------------------------------------------
FROM node:22-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    PORT=4000 \
    DATABASE_FILE=/data/pricescout.db \
    SERVE_STATIC=true

# The database lives on a mounted volume; without one it is lost on redeploy.
RUN mkdir -p /data && chown -R node:node /data

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/server ./server
COPY --from=build --chown=node:node /app/web/dist ./web/dist
COPY --from=build --chown=node:node /app/package.json ./package.json

USER node
EXPOSE 4000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/src/index.js"]
