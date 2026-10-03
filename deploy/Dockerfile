# Образ PMS для сервера (plans/server-kz-2026-09-17.md шаг 0, plans/server-kz-2026-09-18.md шаг 4).
# Один образ на службы api и web: команды разные, код один. Поэтому собранная стойка и
# клиент базы заведомо от одного и того же кода — 17.09.2026 на Mac они разошлись, и журнал действий отвечал 500.
#
# Node 24, как у сторожа на Hostinger (scripts/ops/watch/Dockerfile). API идёт через tsx без сборки
# (apps/api: `tsx src/main.ts`), стойке сборка нужна (`next build` → `next start`, ADR-034).
# Не «тонкий» образ на `next build --standalone`: стойка тянет рабочие пакеты монорепозитория
# (@pms/domain, @pms/shared), standalone их не собирает без отдельной настройки; размер образа здесь ничего не решает.
#
# Секретов в образе нет: .env исключён из контекста сборки (.dockerignore) и подаётся снаружи через env_file (SECURITY.md §3).
FROM node:24-alpine AS build
WORKDIR /app

# Зависимости отдельным слоем: правка кода не переустанавливает node_modules.
# Копируем манифесты всех рабочих пакетов, сохраняя пути, — без любого из них `npm ci` не сойдётся с
# package-lock.json, и падает он не сразу, а на шаге установки; это сторожит tests/unit/deploy-server.test.ts.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# apps/site наружу с этого сервера не выкладывается (главная живёт на Cloudflare Pages),
# но это рабочий пакет: без его манифеста `npm ci` не сойдётся с package-lock.json.
COPY apps/site/package.json apps/site/
COPY packages/database/package.json packages/database/
COPY packages/domain/package.json packages/domain/
COPY packages/integrations/package.json packages/integrations/
COPY packages/shared/package.json packages/shared/
COPY scripts/imports/package.json scripts/imports/
COPY scripts/reconciliation/package.json scripts/reconciliation/

# postinstall пакета базы генерирует Prisma Client из схемы: схема и prisma.config.ts нужны ДО `npm ci`.
# Самой базы для генерации не нужно — только schema.prisma.
COPY packages/database/prisma packages/database/prisma
COPY packages/database/prisma.config.ts packages/database/

# devDependencies нужны и в работе: API и скрипты идут через tsx, стойка собирается next-ом
RUN npm ci --no-audit --no-fund --include=dev

COPY . .
# Потолок кучи для next build: сервер один на 8 ГБ с боевыми службами и CI-раннером, без предела сборка забирала всё
# (сбой 03.10.2026, plans/deploy-build-outage-2026-10-03.md). Не хватит — сборка упадёт, auto-deploy вернёт прежний образ.
RUN NODE_OPTIONS=--max-old-space-size=2048 npm run build -w apps/web

# --- рабочий слой ---------------------------------------------------------------------------------
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Даты проживания — DATE в поясе объекта, события — UTC (AGENTS.md §13).
# Системный пояс контейнера ставим явно, чтобы он не зависел от образа хоста.
ENV TZ=Asia/Almaty
# tzdata — пояс; tini — сигналы и зомби-процессы (PID 1); openssl — клиенту Prisma
RUN apk add --no-cache tzdata tini openssl

COPY --from=build /app /app
USER node
EXPOSE 3000 3001

ENTRYPOINT ["/sbin/tini", "--"]
# Команду задаёт compose: api или web.
CMD ["node", "--import", "tsx", "apps/api/src/main.ts"]
