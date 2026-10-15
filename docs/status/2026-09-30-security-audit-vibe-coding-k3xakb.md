# 30.09.2026: INFRA-ENV, подстановки `${...}` сняты из deploy/compose.yml (черновик PR #206)

Ветка `claude/security-audit-vibe-coding-k3xakb`. Запись перенесена из `CLAUDE.md` (запись дня за 30.09 давно
в `docs/history.md`, файл правил в этой ветке берётся из `main` целиком).

Попутная находка аудита «шесть дыр вайб-кодинга» (отчёт `reports/security-vibe-audit-2026-09-30.md`):
подстановки `${AUTH_REQUIRED:-1}`, `${DATABASE_POOL_MAX:-5}` (служба `api`) и `${APP_AUTH_REQUIRED:-1}` (служба `web`)
в `environment` берут значения из `deploy/.env`, которого нет намеренно, а не из `../.env`, и `environment` старше
`env_file`. Поэтому эти три строки серверного `.env` контейнеры не видели: замки всегда включены, а
`DATABASE_POOL_MAX=3` из `.env` не действовал (пул 5).

Что делает ветка: три строки сняты, пул и замки решает серверный `.env` через `env_file`; умолчания держит код и
они те же (пул 5 в `packages/database`; замки в production включены, пока не выключены явным `0`,
`auth.guard.ts` и `auth-lock.ts`). Тест `tests/unit/deploy-server.test.ts` запрещает подстановки `${...}` в compose
вовсе и сверяет умолчания в коде.

**За владельцем до слияния и выкладки.** С этим изменением строки серверного `.env` `AUTH_REQUIRED=0`,
`APP_AUTH_REQUIRED=0` и `DATABASE_POOL_MAX=<число>` начинают действовать. Если в боевом `.env` лежит забытый
`AUTH_REQUIRED=0` или `APP_AUTH_REQUIRED=0`, после выкладки замок входа выключится. Проверить `.env` на сервере
(и наложение `compose.hostinger.yml`, которого нет в git) и только потом выкладывать. PR остаётся черновиком.
