# Образ PMS для сервера (plans/server-kz-2026-09-17.md, шаг 0). Один образ на API и стойку:
# обе службы поднимаются из него разными командами, поэтому собранная стойка и клиент базы
# заведомо от одного и того же кода — 17.09.2026 на Mac они разошлись, и журнал действий отвечал 500.
#
# Node 24, как у сторожа на Hostinger (scripts/ops/watch/Dockerfile). API идёт через tsx без сборки
# (apps/api: `tsx src/main.ts`), стойке сборка нужна (`next build` → `next start`, ADR-034).
#
# Секретов в образе нет: .env подаётся снаружи через env_file (SECURITY.md §3).
FROM node:24-alpine AS build
WORKDIR /app

# Зависимости отдельным слоем: правка кода не переустанавливает node_modules.
# Копируем манифесты всех рабочих пакетов, сохраняя пути, — npm ci читает их все.
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
COPY packages/database/prisma packages/database/prisma
# postinstall пакета базы генерирует Prisma Client из схемы (поэтому схема скопирована выше).
# Самой базы для генерации не нужно — только schema.prisma.
RUN npm ci

COPY . .
RUN npm run build -w apps/web

# --- рабочий слой ---------------------------------------------------------------------------------
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Даты проживания — DATE в поясе объекта, события — UTC (AGENTS.md §13).
# Системный пояс контейнера ставим явно, чтобы он не зависел от образа хоста.
ENV TZ=Asia/Almaty
RUN apk add --no-cache tzdata

COPY --from=build /app /app
USER node
EXPOSE 3000 3001

# Команду задаёт compose: api, web или разовый прогон синхронизации.
CMD ["node", "--import", "tsx", "apps/api/src/main.ts"]
