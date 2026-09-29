# S6 — действия SAFE / CONFIRM / HUMAN_ONLY и матрица возможностей (29.09.2026)

План — `plans/ai-agents-s6-actions-2026-09-29.md`; поручение владельца — «начинай» после S5. Модель данных PMS не
менялась; у бота — одна новая таблица `support_actions` (миграция `0007`, база бота). Живых денег, прав и броней бот не
касается: это HUMAN_ONLY по построению.

## Матрица возможностей

| Действие | Класс | Что происходит | Право | Куда |
|---|---|---|---|---|
| `channel_pull` | SAFE | подтянуть неподтверждённые ревизии из ленты Channex и обработать | `channels` | `POST /assistant/actions/channel-pull` |
| `channel_sync` | CONFIRM | полная выгрузка остатков и ограничений в Channex на 90 дней | `channels` | `POST /assistant/actions/channel-sync` |
| `refund`, `subscription`, `organization_disable`, `owner_rights`, `data_delete`, `reservations_bulk`, `other_human` | HUMAN_ONLY | бот не выполняет и не обещает: диалог → «нужен человек», запись в журнал | — | `request_human` |

Источник правды — `apps/ai-seller/src/ai/support_actions_matrix.py`; тест `test_matrix_matches_the_plan` сверяет с
этой таблицей.

## Как идёт действие

```
модель зовёт propose_action(action)            ← аргументов «кто/где» нет, область из подписи
  SAFE      → строка журнала CONFIRMED → POST на платформу ключом действий (idempotencyKey = id строки) → DONE/FAILED
  CONFIRM   → строка PROPOSED + предложение в Redis (TTL 15 мин, одно на диалог) → бот спрашивает человека
              «да» → confirm_action → CONFIRMED → POST → DONE/FAILED;  «нет» → cancel_action → CANCELLED;
              позже 15 минут → EXPIRED; новое предложение вытесняет старое (CANCELLED)
  HUMAN_ONLY→ строка REFUSED, подсказка модели: request_human(kind, summary)
request_human → строка ESCALATED (сводка через маску ПД) → диалог NEEDS_HUMAN (чип «Нужен человек» в очереди S1)
```

Платформа на каждый POST проверяет сама: членство (404) → право `channels` (403) → аккаунт пишущий (409) → организация
интеграции (409) → лимит раз в 10 минут на действие и организацию (429) → идемпотентность (повтор в течение часа —
прежний результат, `replayed: true`). «Да» человека платформа не видит и не должна: класс — правило бота, а проверки
платформы одинаковы для обоих классов.

## Что получает модель

- `list_capabilities` → «Что я могу. channel_pull — делаю сам: …; channel_sync — делаю после подтверждения человека: …;
  refund — только человек: …».
- SAFE: «Готово: лента Channex подтянута — ревизий получено 3, обработано 3, со сбоем 0.»
- CONFIRM: «Нужно подтверждение человека: полная выгрузка … на 90 дней … Ответит «да» — вызови confirm_action, «нет» —
  cancel_action. Предложение действует 15 минут.» → после «да»: «Готово: полная выгрузка в Channex — в очередь
  поставлено 180 строк на 90 дней.»
- HUMAN_ONLY: «Это делает только человек (возврат оплаты): не обещай и не выполняй. Вызови request_human …» →
  «Передал человеку: возврат оплаты. Скажи, что вопрос передан специалисту … Диалог отмечен «нужен человек».»
- Сбой платформы, нет ключа действий — «не знаю: уточнит человек» и `FAILED` в журнале.

## Что остаётся только у сервера

`organizationId`/`userId` (из подписи, не от модели), ключи (чтения и действий — разные), адреса Channex, ответ
платформы сверх контракта (в текст идут только числа `received/processed/failed`, `queued/days`), телефон и почта из
сводки для человека (маска `mask_for_log` до записи), id человека в журнале (псевдоним `u_…` как в S4).

## Матрица изоляции и правил

| # | Проверка | Где доказано |
|---|---|---|
| 1 | матрица совпадает с планом; у HUMAN_ONLY нет маршрута и права | бот `test_matrix_matches_the_plan` |
| 2 | у инструментов нет аргументов области; чужой аргумент отвергнут, провайдер не вызван | бот `test_action_tools_have_no_scope_arguments`, `test_model_cannot_pass_foreign_organization` |
| 3 | аноним — отказ на всех четырёх инструментах | бот `test_anonymous_is_refused` |
| 4 | SAFE выполняется сразу, журнал DONE, ключ идемпотентности = id строки, в журнале псевдоним, не id | бот `test_safe_action_runs_at_once_and_is_journaled` |
| 5 | CONFIRM без «да» не выполняется; `confirm_action` выполняет ровно его; повтор — «нечего подтверждать» | бот `test_confirm_action_needs_a_yes_first` |
| 6 | предложение старше 15 минут — EXPIRED, не выполняется | бот `test_stale_proposal_expires` |
| 7 | новое предложение вытесняет старое; отмена — CANCELLED | бот `test_second_proposal_replaces_the_first_and_cancel_cancels` |
| 8 | HUMAN_ONLY никогда не выполняется; `request_human` → NEEDS_HUMAN, сводка без телефона и почты | бот `test_human_only_is_never_executed`, `test_request_human_marks_the_conversation_and_masks_the_summary` |
| 9 | лишние поля платформы (адреса, ключи) не доходят до модели | бот: `callbackUrl`/`apiKey` в фейке, в тексте их нет |
| 10 | ключ чтения на POST — 403; ключ действий на GET — 403; без ключа — 401 | API `actions.controller.test.ts` «ключи» |
| 11 | чужая пара — 404; роль без `channels` — 403; READ_ONLY — 409; без интеграции — 409; кривые id — 400 | API |
| 12 | лимит 429; повтор `idempotencyKey` не выполняет второй раз | API |
| 13 | чтение и выполнение от имени организации запроса (RLS) | API: `databaseTenant()` в фейке `pull` |
| 14 | журнал у диалога — только служебному ключу панели и только администратору платформы; результат через `redactText` | бот `test_support_actions_panel.py`, API `support-kb.controller.test.ts` |
| 15 | кабинет: блок «Действия агента» словами; у диалога без действий блока нет | UI `support-kb.spec.ts` «Действия агента» |

## Что в коде

- Бот: `src/ai/support_actions_matrix.py`, `src/ai/support_actions.py`, `src/ai/support_actions_journal.py`,
  `src/db/models.py` (`SupportAction`), `migrations/versions/0007_support_actions.py`, `Providers.actions` +
  `ActionsProvider`, `WetopSupportMixin.channel_pull/channel_sync` ключом `integration_act_key`, регистрация в
  `build_registry`, runtime в `widget_runner.py`, панель `GET /conversations/{id}/actions`.
- API: `assistant/actions.service.ts`, два маршрута в `assistant.controller.ts`, ключ `assistant-act` и
  `ASSISTANT_ACT_ALLOWED` в `auth.guard.ts`, таблица `route-access`; проходной `GET /platform/support/conversations/:id/actions`
  (`support-kb.service.ts`, `support.connection.ts`, `bot-panel-client.ts`).
- Стойка: `app/platform/support/actions-view.tsx`, `lib/support-actions.ts`, блок в карточке диалога; стенд
  `fixture-api.ts`.
- Документация: `docs/assistant/README.md`, план §14.

## Проверки

Заполняется по логам `tests/runs/` — см. ниже.

## Не сделано и почему

- Кнопка подтверждения в окне чата — S2/S9 (Q-S6-2): подтверждение словом; модель могла бы позвать `confirm_action`
  без «да» — журнал это покажет, лимит и класс ограничивают ущерб.
- Назначение ячейки брони как CONFIRM (Q-S6-3) — нет: правила броней отдельное решение.
- Telegram при `request_human` — S7; сейчас только отметка «нужен человек» и журнал.
- `ASSISTANT_ACT_KEY` на сервере не задан: пока владелец не впишет его (платформа) и `INTEGRATION_ACT_KEY` (бот), бот
  только читает — матрица и HUMAN_ONLY работают, SAFE/CONFIRM отвечают «не знаю».

**Стоп: S7 без отдельного подтверждения не начинать.**
