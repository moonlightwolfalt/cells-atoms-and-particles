# Island Forge — production image (used by Sevalla, or any Docker host).
# Builds the web app, then runs the TypeScript server directly with Node's built-in type stripping.

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY island-forge/package.json island-forge/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY island-forge/tsconfig.base.json island-forge/tsconfig.json ./
COPY island-forge/core ./core
COPY island-forge/server ./server
COPY island-forge/scripts ./scripts
COPY island-forge/web ./web
RUN npm run build && npm prune --omit=dev --omit=optional

FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    ISLAND_FORGE_PUBLIC=1
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/core/src ./core/src
COPY --from=build --chown=node:node /app/server/providers.ts /app/server/server.ts ./server/
COPY --from=build --chown=node:node /app/web/dist ./web/dist
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/server.ts"]
