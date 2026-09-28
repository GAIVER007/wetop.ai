# Проверка репозитория 22.09.2026 — облачная сессия

Поручение владельца: «проверь, что всё работает, синхронизация с GitHub, незакоммиченные правки, весь код,
чего не хватает — план и вперёд». Ветка `claude/dazzling-newton-xmmsjf`, слита со свежим `main` (`87c14fb0`, ADR-068).
Короткая запись — `CLAUDE.md` §2 за 22.09; здесь подробности, которых в записи нет.

## 1. Синхронизация с GitHub

- Клон контейнера был мелким (shallow): первая сверка показала «`main` переписан, 94 коммита выпали». После
  `git fetch --unshallow` (825 коммитов) история цела. Строка в `TESTING.md` §4.
- Рабочее дерево чистое; правок на Mac владельца из контейнера не видно — проверять там: `git status`, `git log origin/main..HEAD`.
- `main` двигался во время проверки дважды (другая сессия: `c668535`, затем `4fdff97`+`87c14fb`), оба раза влит.
- CI мёртв с 20.09: бюджет Actions $0, свой раннер не зарегистрирован; прогоны на `main` — `cancelled`/`pending`.
  Из-за этого задание `db` (миграции, integration, e2e на чистой PostgreSQL) не запускалось ни разу после 20.09 —
  три миграции без отката прошли незамеченными.

### Ветки на `origin`, не сведённые в `main` по истории

| Ветка | Последний коммит | Впереди | Новых по patch-id | PR | Что делать |
|---|---|---|---|---|---|
| `backup/pms-lux-2026-09-14` | 2026-09-14 | 7 | 7 | — — | резервная копия — оставить |
| `chore/week-close` | 2026-09-20 | 1 | 0 | #43 слит | удалить: содержимое в `main` (squash), patch-id пуст |
| `claude/confident-hypatia-4efdx7` | 2026-09-21 | 35 | 27 | #9 открыт с 15.09, устарел — план `plans/pr9-leftovers-2026-09-22.md` | по решению владельца |
| `claude/project-status-check-pkq33o` | 2026-09-21 | 1 | 1 | #57 открыт (черновик, только отчёт 21.09) | по решению владельца |
| `codex/chessboard-design` | 2026-09-20 | 1 | 0 | #37 слит | удалить: содержимое в `main` (squash), patch-id пуст |
| `codex/inventory-catalog` | 2026-09-20 | 2 | 2 | #35 слит | удалить: PR слит squash из нескольких коммитов |
| `codex/navigation-sections` | 2026-09-20 | 1 | 0 | #36 слит | удалить: содержимое в `main` (squash), patch-id пуст |
| `codex/pause-self-registration` | 2026-09-20 | 9 | 6 | #34 слит | удалить: PR слит squash из нескольких коммитов |
| `codex/reservations-design` | 2026-09-20 | 2 | 2 | #41 слит | удалить: PR слит squash из нескольких коммитов |
| `codex/section-loading-performance` | 2026-09-20 | 2 | 2 | #44 слит | удалить: PR слит squash из нескольких коммитов |
| `design/claude-design-sync` | 2026-09-20 | 2 | 2 | — — | без PR, входные файлы Claude Design — за владельцем |
| `docs/adr-numbers` | 2026-09-20 | 1 | 0 | #49 слит | удалить: содержимое в `main` (squash), patch-id пуст |
| `docs/claude-md-trim` | 2026-09-20 | 1 | 0 | #51 слит | удалить: содержимое в `main` (squash), patch-id пуст |
| `docs/cutover-refresh` | 2026-09-20 | 1 | 0 | #50 слит | удалить: содержимое в `main` (squash), patch-id пуст |
| `docs/server-scripts` | 2026-09-20 | 1 | 0 | #47 слит | удалить: содержимое в `main` (squash), patch-id пуст |
| `feat/cert-cycle-modify` | 2026-09-20 | 1 | 0 | #45 слит | удалить: содержимое в `main` (squash), patch-id пуст |
| `feat/email-verification` | 2026-09-20 | 2 | 1 | #38 слит | удалить: PR слит squash из нескольких коммитов |
| `feat/isolation-and-fixes` | 2026-09-20 | 3 | 3 | #42 слит | удалить: PR слит squash из нескольких коммитов |
| `feat/org-isolation` | 2026-09-20 | 3 | 2 | #39 слит | удалить: PR слит squash из нескольких коммитов |
| `fix/audit-findings` | 2026-09-20 | 3 | 2 | #40 слит | удалить: PR слит squash из нескольких коммитов |
| `fix/cycle-robust` | 2026-09-20 | 1 | 0 | #46 слит | удалить: содержимое в `main` (squash), patch-id пуст |
| `fix/report-fallback` | 2026-09-20 | 1 | 0 | #48 слит | удалить: содержимое в `main` (squash), patch-id пуст |
| `plans/demo-recording` | 2026-09-20 | 1 | 0 | #52 слит | удалить: содержимое в `main` (squash), patch-id пуст |

Ветки, целиком в истории `main` (можно удалить): `chore/journal-2026-09-17`, `claude/blissful-meitner-ipoauv`, `claude/dreamy-faraday-vxjpj9`, `claude/epic-goldberg-743uda`, `claude/gifted-planck-5o1ymi`, `claude/inspiring-pasteur-urrgr8`, `claude/practical-bardeen-pu5luq`, `claude/relaxed-carson-ekb1gc`, `claude/server-kz-parallel`, `claude/trusting-ramanujan-gi6uzl`, `codex/current-release-acceptance`, `codex/hostel-frontend`, `codex/premium-ui-system`, `codex/settings-simplification`, `feat/design-slop`, `feat/duty-and-guard-server`, `feat/login-password-register`, `fix/compose-server-run`, `fix/guard-retired-source-alarm`, `merge/retired-source-off-into-main`, `merge/settings-simplification`.

Резервные копии (оставить): `backup/pms-lux-2026-09-14`, `backup/second-merge-2026-09-20`.

Команды удаления — запускает владелец с Mac. 22.09 в 09:15 UTC облачная сессия по поручению «удали что нужно» попыталась
удалить эти 39 веток сама: push с удалением отбит политикой прокси контейнера (HTTP 403, README прокси: «не обходить,
сообщить»), а удаление по одной — классификатором сеанса как разрушительная операция git. Ни одна ветка не удалена.
Оставлены намеренно: резервные копии, ветки PR #9 и #57, `design/claude-design-sync`, `claude/gifted-planck-5o1ymi`
(параллельная сессия, пушила в `main` 22.09) и `claude/dazzling-newton-xmmsjf`. **Сделано владельцем с Mac в 09:20 UTC:** все 39 веток
удалены, `git fetch --prune` снял 39 ссылок, на `origin` осталось 8. Команды — для истории:

```
git push origin --delete chore/journal-2026-09-17
git push origin --delete chore/week-close
git push origin --delete claude/blissful-meitner-ipoauv
git push origin --delete claude/dreamy-faraday-vxjpj9
git push origin --delete claude/epic-goldberg-743uda
git push origin --delete claude/gifted-planck-5o1ymi
git push origin --delete claude/inspiring-pasteur-urrgr8
git push origin --delete claude/practical-bardeen-pu5luq
git push origin --delete claude/relaxed-carson-ekb1gc
git push origin --delete claude/server-kz-parallel
git push origin --delete claude/trusting-ramanujan-gi6uzl
git push origin --delete codex/chessboard-design
git push origin --delete codex/current-release-acceptance
git push origin --delete codex/hostel-frontend
git push origin --delete codex/inventory-catalog
git push origin --delete codex/navigation-sections
git push origin --delete codex/pause-self-registration
git push origin --delete codex/premium-ui-system
git push origin --delete codex/reservations-design
git push origin --delete codex/section-loading-performance
git push origin --delete codex/settings-simplification
git push origin --delete docs/adr-numbers
git push origin --delete docs/claude-md-trim
git push origin --delete docs/cutover-refresh
git push origin --delete docs/server-scripts
git push origin --delete feat/cert-cycle-modify
git push origin --delete feat/design-slop
git push origin --delete feat/duty-and-guard-server
git push origin --delete feat/email-verification
git push origin --delete feat/isolation-and-fixes
git push origin --delete feat/login-password-register
git push origin --delete feat/org-isolation
git push origin --delete fix/audit-findings
git push origin --delete fix/compose-server-run
git push origin --delete fix/cycle-robust
git push origin --delete fix/guard-retired-source-alarm
git push origin --delete fix/report-fallback
git push origin --delete merge/retired-source-off-into-main
git push origin --delete merge/settings-simplification
git push origin --delete plans/demo-recording
```

## 2. Прогоны 22.09 с 12:00 до 15:00 Алматы — этой и параллельной сессии (журнал `tests/runs/JOURNAL.md`)

Локальная PostgreSQL 16 (`npm run db:local`), production-сборка стойки, браузер контейнера через `CHROMIUM_PATH`.

| Когда | Набор | Итог | Время | Коммит | Лог | Зачем |
|---|---|---|---|---|---|---|
| 22.09.2026 12:00 | integration | ✅ 44 из 44 | 18 с | c668535 | [лог](logs/2026-09-22T07-00-43Z-integration-3c61.log) | main c668535 на локальной PostgreSQL 16 в облачной сессии |
| 22.09.2026 12:01 | e2e | ❌ упало 1 из 25 | 2 мин 7 с | c668535 | [лог](logs/2026-09-22T07-01-50Z-e2e-7796.log) | main c668535 на локальной PostgreSQL 16 с сидом, production-сборка стойки, облачная сессия |
| 22.09.2026 12:04 | e2e (частично: --config tests/site/playwright.config.ts) | ❌ упало 1 из 7 | 31 с | c668535 | [лог](logs/2026-09-22T07-04-45Z-e2e-1553.log) | главная wetop.ai на main c668535, облачная сессия |
| 22.09.2026 12:06 | e2e | ✅ 25 из 25 | 1 мин 31 с | c668535 +1 | [лог](logs/2026-09-22T07-06-01Z-e2e-1a6d.log) | main c668535 + спек неисправностей на новой фразе экрана (21.09 «без каши»); локальная PostgreSQL 16 с сидом |
| 22.09.2026 12:12 | e2e (частично: --config tests/site/playwright.config.ts) | ✅ 7 из 7 | 16 с | c668535 +1 | [лог](logs/2026-09-22T07-12-08Z-e2e-7724.log) | главная wetop.ai на main c668535 + тест «Как начать» приведён к ADR-056 (заявка, без снятых обещаний) |
| 22.09.2026 12:12 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ❌ упало 5 из 320 | 30 мин 7 с | c668535 +1 | [лог](logs/2026-09-22T07-12-25Z-e2e-b8c4.log) | полный UI-набор на main c668535 + правки двух спеков (неисправности, главная сайта), облачная сессия |
| 22.09.2026 12:43 | unit (частично: tests/unit/migrations-rollback.test.ts) | ❌ упало 3 из 19 | 1 с | fd6e2f9 +1 | [лог](logs/2026-09-22T07-43-14Z-unit-eabc.log) | сторож откатов миграций: красный на трёх миграциях 20.09 без down.sql |
| 22.09.2026 12:43 | unit (частично: tests/unit/migrations-rollback.test.ts) | ✅ 19 из 19 | 1 с | fd6e2f9 +4 | [лог](logs/2026-09-22T07-43-59Z-unit-7311.log) | сторож откатов миграций: зелёный после down.sql для трёх миграций 20.09 |
| 22.09.2026 12:47 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/design-refresh.spec.ts tests/ui/housekeeping.spec.ts tests/ui/onboarding.spec.ts test | ✅ 31 из 31 | 2 мин 33 с | fd6e2f9 +7 | [лог](logs/2026-09-22T07-47-08Z-e2e-0cbe.log) | после починки пяти красных полного набора: каталог на 390 px (перенос календаря), гонка уборки, локатор онбординга, «Название отеля» в закрытой регис
| 22.09.2026 12:08 | unit (частично: apps/api/src/reservations/reservations.controller.test.ts) | ❌ упало 1 из 21 | 4 с | c668535 +1 | [лог](logs/2026-09-22T07-08-25Z-unit-35f7.log) | Q-155/Q-156: API до правки службы — выезд ещё не ставит «требует уборки» |
| 22.09.2026 12:08 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/housekeeping.spec.ts) | ❌ упало 2 из 6 | 1 мин 1 с | c668535 +2 | [лог](logs/2026-09-22T07-08-30Z-e2e-04bc.log) | Q-155/Q-156: red на нынешних экранах — нет предупреждения, выезд не ставит уборку |
| 22.09.2026 12:11 | unit (частично: apps/api/src/reservations/reservations.controller.test.ts) | ✅ 21 из 21 | 3 с | c668535 +8 | [лог](logs/2026-09-22T07-11-11Z-unit-14d9.log) | Q-155/Q-156: выезд ставит «требует уборки», карточка знает статус ячейки |
| 22.09.2026 12:11 | typecheck | ❌ ошибок: 3 | 23 с | c668535 +13 | [лог](logs/2026-09-22T07-11-15Z-typecheck-dac3.log) | Q-155/Q-156: домен, API, стойка, фикстура, живые спеки |
| 22.09.2026 12:11 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/housekeeping.spec.ts) | ❌ упало 1 из 6 | 40 с | c668535 +13 | [лог](logs/2026-09-22T07-11-38Z-e2e-be81.log) | Q-155/Q-156: после правки |
| 22.09.2026 12:12 | typecheck | ✅ без ошибок | 18 с | c668535 +13 | [лог](logs/2026-09-22T07-12-46Z-typecheck-1e14.log) | Q-155/Q-156: статус уборки в карточке — необязательное поле |
| 22.09.2026 12:14 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/housekeeping.spec.ts) | ✅ 6 из 6 | 25 с | c668535 +14 | [лог](logs/2026-09-22T07-14-06Z-e2e-58a8.log) | Q-155/Q-156: карточка передаёт статус уборки в панель действий |
| 22.09.2026 12:15 | typecheck | ✅ без ошибок | 18 с | c668535 +14 | [лог](logs/2026-09-22T07-15-06Z-typecheck-0f86.log) | Q-155/Q-156: статус уборки в панели действий |
| 22.09.2026 12:15 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/manager-actions.spec.ts tests/ui/workspace.spec.ts tests/ui/quality.spec.ts) | ✅ 85 из 85 | 3 мин 36 с | c668535 +14 | [лог](logs/2026-09-22T07-15-25Z-e2e-3767.log) | Q-155/Q-156: соседние наборы, партия 1 |
| 22.09.2026 12:19 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/chessboard-week.spec.ts tests/ui/chessboard-month.spec.ts tests/ui/chessboard-blocks. | ✅ 44 из 44 | 3 мин 43 с | c668535 +14 | [лог](logs/2026-09-22T07-19-24Z-e2e-6f85.log) | Q-155/Q-156: соседние наборы, партия 2 |
| 22.09.2026 12:23 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/requests.spec.ts tests/ui/accessibility.spec.ts) | ✅ 30 из 30 | 4 мин 4 с | c668535 +14 | [лог](logs/2026-09-22T07-23-19Z-e2e-cde5.log) | Q-155/Q-156: соседние наборы, партия 3 |
| 22.09.2026 12:27 | lint | ✅ без ошибок | 12 с | c668535 +14 | [лог](logs/2026-09-22T07-27-24Z-lint-9521.log) | Q-155/Q-156: выезд → «требует уборки», предупреждение при заселении |
| 22.09.2026 12:27 | unit | ✅ 1398 из 1401, пропущено 3 | 1 мин 12 с | c668535 +9 | [лог](logs/2026-09-22T07-27-37Z-unit-5852.log) | Q-155/Q-156: выезд → «требует уборки», предупреждение при заселении |
| 22.09.2026 12:32 | typecheck | ✅ без ошибок | 23 с | 4fdff97 +1 | [лог](logs/2026-09-22T07-32-21Z-typecheck-21e8.log) | окно заселения: тон кнопки основной |
| 22.09.2026 12:32 | lint | ✅ без ошибок | 13 с | 4fdff97 +1 | [лог](logs/2026-09-22T07-32-45Z-lint-bda8.log) | окно заселения: тон кнопки основной |
| 22.09.2026 12:33 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/housekeeping.spec.ts) | ✅ 6 из 6 | 23 с | 4fdff97 +1 | [лог](logs/2026-09-22T07-33-47Z-e2e-c795.log) | окно заселения: тон кнопки основной |
| 22.09.2026 12:52 | unit | ✅ 1417 из 1420, пропущено 3 | 1 мин 27 с | b9e74c3 | [лог](logs/2026-09-22T07-52-46Z-unit-0c4d.log) | слитое дерево: main 87c14fb0 (ADR-068) + починки 22.09 + сторож откатов миграций |
| 22.09.2026 12:54 | typecheck | ✅ без ошибок | 33 с | b9e74c3 | [лог](logs/2026-09-22T07-54-14Z-typecheck-a9fb.log) | слитое дерево: main 87c14fb0 + починки 22.09 |
| 22.09.2026 12:54 | lint | ✅ без ошибок | 19 с | b9e74c3 | [лог](logs/2026-09-22T07-54-48Z-lint-d76a.log) | слитое дерево: main 87c14fb0 + починки 22.09 |
| 22.09.2026 12:55 | e2e | ✅ 25 из 25 | 1 мин 33 с | b9e74c3 | [лог](logs/2026-09-22T07-55-39Z-e2e-efb2.log) | слитое дерево: выселение ставит «требует уборки» и предупреждение при заселении (ADR-068) впервые на живой базе; production-сборка стойки |
| 22.09.2026 12:57 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/housekeeping.spec.ts tests/ui/manager-actions.spec.ts tests/ui/workspace.spec.ts) | ✅ 77 из 77 | 4 мин 58 с | b9e74c3 | [лог](logs/2026-09-22T07-57-29Z-e2e-36fe.log) | слитое дерево: спеки, которые трогала правка ADR-068 (окно «ещё не проверена» при заселении), плюс ожидание статуса в тесте уборки |
| 22.09.2026 13:03 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1) | ✅ 322 из 322 | 29 мин 40 с | ff1e4b0 | [лог](logs/2026-09-22T08-03-18Z-e2e-67db.log) | полный UI-набор на слитом дереве: main 87c14fb0 (ADR-068) + починки 22.09 (каталог на 390, три спека) |
| 22.09.2026 13:33 | integration | ✅ 44 из 44 | 18 с | dda701a | [лог](logs/2026-09-22T08-33-55Z-integration-d433.log) | итоговое дерево dda701a7 (слитый main 87c14fb0 + починки 22.09) |
| 22.09.2026 14:03 | integration | ✅ 44 из 44 | 16 с | 87c14fb +1 | [лог](logs/2026-09-22T09-03-48Z-integration-4c1c.log) | локальный стенд на сборке PostgreSQL 16 из npm (без системной PostgreSQL) |
| 22.09.2026 14:04 | e2e | ❌ упало 1 из 25 | 1 мин 54 с | 87c14fb +1 | [лог](logs/2026-09-22T09-04-26Z-e2e-8757.log) | живые сквозные на локальном стенде (PostgreSQL 16 из npm), собранная стойка, после ADR-068 |
| 22.09.2026 14:07 | e2e (частично: tests/e2e/incidents.spec.ts --workers=1) | ✅ 2 из 2 | 9 с | 87c14fb +2 | [лог](logs/2026-09-22T09-07-04Z-e2e-e9d9.log) | живой спек неисправностей: ожидание по фразе экрана после редизайна 21.09 |
| 22.09.2026 14:23 | unit | ❌ упало 4 из 1426, пропущено 3 | 1 мин 18 с | 0e704e0 +1 | [лог](logs/2026-09-22T09-23-42Z-unit-b7c3.log) | слитое дерево 0e704e0 + снятие дублирующего правила календаря (главная — kit.css владельца 6f877823) |
| 22.09.2026 14:25 | typecheck | ❌ ошибок: 2 | 34 с | 0e704e0 +1 | [лог](logs/2026-09-22T09-25-01Z-typecheck-31de.log) | слитое дерево 0e704e0 (rates/channex владельца + починки 22.09) |
| 22.09.2026 14:25 | lint | ✅ без ошибок | 21 с | 0e704e0 +1 | [лог](logs/2026-09-22T09-25-36Z-lint-b9b4.log) | слитое дерево 0e704e0 |
| 22.09.2026 14:28 | unit (частично: tests/unit/design-slop.test.ts tests/unit/local-db-start.test.ts apps/web/src/design-rules.test.ts apps/api/src/channels/channels.controller.tes | ✅ 35 из 35 | 4 с | 0e704e0 +5 | [лог](logs/2026-09-22T09-28-02Z-unit-97d7.log) | четыре красных после слияния локальных коммитов владельца (rates.css литерал, « · » в подписи Channex, подделки без localRatePlanCode, local-db мимо заглуш
| 22.09.2026 14:28 | unit | ✅ 1423 из 1426, пропущено 3 | 1 мин 12 с | 0e704e0 +5 | [лог](logs/2026-09-22T09-28-19Z-unit-e785.log) | слитое дерево 0e704e0 + четыре починки после локальных коммитов владельца |
| 22.09.2026 14:29 | typecheck | ✅ без ошибок | 26 с | 0e704e0 +5 | [лог](logs/2026-09-22T09-29-32Z-typecheck-a022.log) | слитое дерево 0e704e0 + подделки сопоставлений с localRatePlanCode |
| 22.09.2026 14:29 | lint | ✅ без ошибок | 19 с | 0e704e0 +5 | [лог](logs/2026-09-22T09-29-58Z-lint-386a.log) | слитое дерево 0e704e0 + починки |
| 22.09.2026 14:30 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/design-refresh.spec.ts tests/ui/design-system.spec.ts tests/ui/date-field.spec.ts tes | ✅ 33 из 33 | 4 мин 24 с | 0e704e0 +5 | [лог](logs/2026-09-22T09-30-33Z-e2e-4b97.log) | слитое дерево: каталог после снятия дублирующего правила (главное — kit.css владельца), тарифы с подписью Channex через запятую, каналы |
| 22.09.2026 14:35 | e2e | ❌ упало 1 из 25 | 5 мин 37 с | 0e704e0 +5 | [лог](logs/2026-09-22T09-35-47Z-e2e-2a99.log) | слитое дерево с починками после локальных коммитов владельца (полная выгрузка без ограничений без цены, подпись Channex на /rates); db:local через psql |
| 22.09.2026 14:43 | unit | ✅ 1423 из 1426, пропущено 3 | 1 мин 12 с | 6d50ddb | [лог](logs/2026-09-22T09-43-04Z-unit-a088.log) | слитое дерево 6d50ddb: main 51e1393a (починки владельца) + local-db.sh через psql |
| 22.09.2026 14:44 | typecheck | ✅ без ошибок | 24 с | 6d50ddb | [лог](logs/2026-09-22T09-44-17Z-typecheck-9a55.log) | слитое дерево 6d50ddb |
| 22.09.2026 14:44 | lint | ✅ без ошибок | 18 с | 6d50ddb | [лог](logs/2026-09-22T09-44-42Z-lint-a34c.log) | слитое дерево 6d50ddb |
| 22.09.2026 14:45 | e2e (частично: --config tests/ui/playwright.config.ts --workers=1 tests/ui/rates-design.spec.ts tests/ui/channex-screens.spec.ts) | ✅ 13 из 13 | 1 мин 4 с | 6d50ddb | [лог](logs/2026-09-22T09-45-10Z-e2e-d0e7.log) | слитое дерево 6d50ddb: подпись Channex на /rates в редакции владельца (51e1393a) |
| 22.09.2026 14:46 | e2e | ✅ 25 из 25 | 1 мин 34 с | 6d50ddb | [лог](logs/2026-09-22T09-46-42Z-e2e-1f9b.log) | слитое дерево 6d50ddb (main 51e1393a): повтор после таймаута desk-tasks; db:local через psql |

Полный UI-набор на слитом дереве — второй прогон: **322 из 322** за 29 мин 40 с (`tests/runs/logs/2026-09-22T08-03-18Z-e2e-67db.log`).

Повторная проверка по поручению «проверь ещё раз» (20:05–20:31 Алматы) на итоговом `main` `42140e2b`: integration 44/44 (`tests/runs/logs/2026-09-22T15-05-03Z-integration-2f06.log`), откаты 18 миграций `RESULT: OK`, полный UI-набор **322 из 322** за 24 мин 49 с (`tests/runs/logs/2026-09-22T15-06-20Z-e2e-21af.log`).

## 3. Что найдено и сделано

| Находка | Что сделано | Доказательство |
|---|---|---|
| Три миграции 20.09 без `down.sql` (AGENTS.md §14) | откаты дописаны; сторож `tests/unit/migrations-rollback.test.ts` | `check-migrations.sh` `FAIL (3)` → `RESULT: OK` по 18 миграциям; сторож red 3/19 → green |
| `/design-system` на 390 px уезжает вбок на 131 px | перенос календаря под поле только для раскрытого в потоке (`globals.css`) | `design-refresh` 390 px зелёный, эталоны каталога на 1440 не изменились (`design-system` 9/9) |
| Живой спек неисправностей на старой фразе экрана | фраза экрана 21.09 | e2e 24/25 → 25/25 |
| Тест сайта на снятом обещании (E2–E3 против ADR-056) | тест на ADR-056; расхождение решений — Q-157 | `site:check` 6/7 → 7/7 |
| Три UI-теста отстали от кода 21–22.09 (уборка, онбординг, регистрация) | ожидание статуса, `exact`, поле «Название отеля» | 31/31 по затронутым спекам; после слияния 77/77 |
| Из PR #9 в `main` не попали разборы приёма Channex и импорта, 8 вопросов, отчёт о шрифтах | перенесены; код сверок — план | `plans/pr9-leftovers-2026-09-22.md`, Q-158…Q-165 |
| `CLAUDE.md` 127 000 знаков, записи 20–21.09 не перенесены в хронику | перенесены тем же текстом | `docs/history.md`, файл правил ≈ 28 000 знаков |
| Заметка «свободный номер ADR» устарела, в §1 CLAUDE.md «до 057» | 064 свободен, следующий 069; в §1 — до 067, пять номеров дважды | `DECISIONS.md`, `CLAUDE.md` §1 |
| После fast-forward в `main` туда же пришли пять локальных коммитов владельца (`76c5a06d`), и слитое дерево оказалось красным: unit 4/1426, typecheck 2 ошибки (литерал цвета в `rates.css`, « · » в подписи Channex, подделки без `localRatePlanCode`, `local-db.sh` мимо заглушки `psql`) | цвет токеном, запятая, поле в подделках, `psql`/`createdb` при наличии; дублирующее правило календаря в `globals.css` снято в пользу `kit.css` владельца | 35/35 по четырём файлам → unit 1423/1426, typecheck и lint чисто; строка в TESTING.md §4 |
| `npm audit --omit=dev`: 2 moderate (`uuid` < 11.1.1 через `exceljs`) | не трогал: починка — только откат `exceljs` до 3.4.0 | — |
| prettier: 129 файлов не по стилю | не трогал: `format` не входит в `check` и в CI; массовое форматирование — отдельным коммитом по решению владельца | — |

## 4. За владельцем

1. CI: бюджет Actions и токен регистрации раннера (`scripts/ops/ci-runner`).
2. Выкладка на сервер: из контейнера нет SSH; `app.wetop.ai` на старом образе (`docs/deploy.md` §1а).
3. ~~Слить ветку `claude/dazzling-newton-xmmsjf` в `main`; влить PR #57; удалить ветки командами выше~~ — сделано 22.09 (ветка — fast-forward `6a461b41`, PR #57 — `7d12c063`, 39 веток удалены владельцем). Осталось: закрыть PR #9 после решения по плану.
4. Ответить: Q-157 (что обещает сайт), Q-158…Q-161 (приём броней Channex — четыре живых дефекта до первого канала), Q-162…Q-165 (повторный импорт дампа).
5. Из отчёта 21.09 без изменений: дамп 19.09 в одной копии на том же сервере, восстановление не проверено; пять условий допуска ждут человека.
6. Семь открытых вопросов спрашивают про данные архивный источник, которых после очистки базы 19.09 (ADR-052) нет (из разбора 21.09,
   `reports/project-status-2026-09-21.md` §5). Ответить на них нельзя и не нужно, но они держат сводку открытых и прячут
   вопросы живой смены. Предлагаемая формулировка закрытия, одна на все: «Снят 22.09.2026 вместе с архивный источник (ADR-052): данных,
   о которых вопрос, в PMS больше нет; вернётся только с повторным импортом дампа 19.09». Закрыть может только владелец — одним словом «закрой»:
- **Q-101** — Тарифы Островка («Стандартный», «Невозвратный −10%», «В2В») имеют цены только до **31.12.2026**. Продлевать на 2027 (в архивный источник сейчас или уже в новой…
- **Q-109** — Будущие брони каналов, неотличимые по каналу, категории и датам (на 12.09 — 16 в 8 группах, на 13.09 уже 25 в 12 группах: список живой, считается к…
- **Q-110** — При связывании подтянутой брони предоплата канала (`payment_collect = ota`) не записывается, если по счёту уже что-то оплачено из архивный источник (на 11.09 —…
- **Q-119** — Мужской дом продан сверх вместимости на ночь 12.09.2026: 37 проживаний на 36 коек, обе спорные брони заселены. Что делает стойка — доселяет гостя в…
- **Q-134** — Платежи, перенесённые из архивный источник (`EXTERNAL retired-source:<roomStayId>`), датированы днём переноса, а не днём оплаты в архивный источник: «Получено оплат» на главной и в…
- **Q-147** — Проживание исчезло из карточки архивный источник (ADR-050), но у него на счёте есть оплата (платёж `EXTERNAL retired-source:<stay>`) или гость заселён. Что делать с ден…
- **Q-148** — Проверить на настоящем возврате в архивный источник, что означает `toRefundAmount` после исполненного возврата: обнуляется ли оплата (`amount − toPay`)? От это…
