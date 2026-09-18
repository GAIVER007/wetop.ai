# Образ PMS: один на три службы (api, web, exely-sync) — команды разные, код один.
# plans/server-kz-2026-09-18.md шаг 4. Собирается на сервере: `docker compose -f deploy/compose.yml build`.
#
# Почему не «тонкий» образ на `next build --standalone`: стойка живёт в монорепозитории и тянет
# рабочие пакеты (@pms/domain, @pms/shared) — standalone их не собирает без отдельной настройки.
# Нагрузка объекта такая, что размер образа здесь ничего не решает.
FROM node:22-slim

# openssl нужен клиенту Prisma; ca-certificates — исходящим вызовам Exely и Channex
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates tini \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
WORKDIR /app

# Сначала манифесты всех рабочих пакетов: без любого из них `npm ci` в образе падает,
# и падает не сразу, а на шаге установки — это и сторожит tests/unit/deploy-server.test.ts
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/site/package.json apps/site/
COPY packages/database/package.json packages/database/
COPY packages/domain/package.json packages/domain/
COPY packages/integrations/package.json packages/integrations/
COPY packages/shared/package.json packages/shared/
COPY scripts/imports/package.json scripts/imports/
COPY scripts/reconciliation/package.json scripts/reconciliation/

# Клиент Prisma генерируется на postinstall (docs/deploy.md) — схема нужна до `npm ci`
COPY packages/database/prisma packages/database/prisma
COPY packages/database/prisma.config.ts packages/database/

# devDependencies нужны и в работе: API и скрипты идут через tsx, стойка собирается next-ом
RUN npm ci --no-audit --no-fund --include=dev

COPY . .

# Стойка собирается на этапе образа: `next start` без сборки не поднимется
RUN npm run build -w apps/web

USER node
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["npm", "run", "start", "-w", "apps/api"]
