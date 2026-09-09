# apps

| Папка | Назначение | Статус |
|---|---|---|
| `web/` | Next.js 16 + React 19 — интерфейс стойки | `/inventory`, `/chessboard`, `/reservations/[number]` (09.09.2026); `npm run dev -w apps/web`, e2e `npm run e2e` |
| `api/` | NestJS + TypeScript — backend | `/inventory/*`, `/chessboard?from&to`, `/reservations/:number` (09.09.2026); `npm run start -w apps/api` |

`DATA_MODEL.md` утверждён 07.09.2026 (кроме §6). Приложения создаются на шагах 6–7
`plans/slice-1-inventory.md`; до этого папки пустые.
