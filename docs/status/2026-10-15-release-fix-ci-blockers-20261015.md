**15.10.2026, ветка `claude/release-fix-ci-blockers-20261015`: гейт `main` снова собирается, типы в `tests/beauty-ui/unified-growth.spec.ts`.**

Гейт #546 на `main` `80f18f30` падал на корневом `npm run typecheck`: помощник `ok` в спеке принимал
`Awaited<ReturnType<APIRequestContext['post']>>`, и `res.json()` выводился как `unknown` (11 ошибок TS18046/TS2571).
Параметр теперь `APIResponse`, как у соседних спек. Поведение теста не менялось.

Аудит гейта на `80f18f30` (локально, до правки и после):
- lint, `typecheck:api`, `typecheck:web` зелёные; корневой typecheck красный до правки, зелёный после;
- unit: 4783 прошли; `fixture-demo` и `server-bootstrap` упали по таймауту под нагрузкой контейнера, отдельно 4/4 зелёные;
- `design-slop`, `build-tokens`, `ui-fixture-address`, красные в #541, на этом `main` уже зелёные (PR #525, #526, #531).

За владельцем: слияние PR правки и PR F1 (#533), после зелёного гейта на `main` выкладка идёт сама (`auto-release`).
