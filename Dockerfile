FROM node:22-bookworm-slim AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/admin/package.json ./apps/admin/package.json
COPY apps/mobile/package.json ./apps/mobile/package.json
COPY packages/shared-schemas/package.json ./packages/shared-schemas/package.json
COPY packages/shared-types/package.json ./packages/shared-types/package.json
COPY packages/shared-utils/package.json ./packages/shared-utils/package.json
RUN npm ci

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY prisma ./prisma
COPY prisma.config.ts ./
ENV DATABASE_URL_UNPOOLED=postgresql://liena:liena@localhost:5432/liena?schema=public
RUN npm run db:generate

FROM dependencies AS build

COPY tsconfig*.json ./
COPY apps/api ./apps/api
COPY apps/admin ./apps/admin
COPY packages ./packages

ARG VITE_API_URL=/api/v1
RUN npm run build:api && VITE_API_URL=$VITE_API_URL npm run build:admin

FROM dependencies AS migrate

COPY prisma.config.ts ./
COPY prisma ./prisma
CMD ["npm", "run", "db:migrate:deploy"]

FROM node:22-bookworm-slim AS api

WORKDIR /app
ENV NODE_ENV=development
ENV PORT=3000

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/admin/package.json ./apps/admin/package.json
COPY apps/mobile/package.json ./apps/mobile/package.json
COPY packages/shared-schemas/package.json ./packages/shared-schemas/package.json
COPY packages/shared-types/package.json ./packages/shared-types/package.json
COPY packages/shared-utils/package.json ./packages/shared-utils/package.json
RUN npm ci --omit=dev && npm cache clean --force

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=dependencies /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/apps/api/dist ./apps/api/dist

USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "apps/api/dist/server.js"]

FROM nginx:stable-alpine AS admin

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/admin/dist /usr/share/nginx/html

EXPOSE 80
