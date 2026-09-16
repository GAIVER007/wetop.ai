# AGENT RULES

Правила обязательны для любого AI-агента (Claude Code, Codex, Cursor) и для человека.
Нарушение правила — основание отклонить работу целиком, даже если код рабочий.

---

## 1. Plan before implementation

Если задача изменяет больше одной функции, таблицу БД, API-контракт,
интеграцию или пользовательский сценарий — **сначала предоставить план**.

До подтверждения плана не создавать и не изменять код.

Причина: план исправляется сообщением; ошибочная реализация — часами или днями.

---

## 2. Data model is controlled by DATA_MODEL.md

Любое изменение:

- сущности;
- поля;
- связи;
- cardinality;
- reservation allocation;
- pricing;
- folio

сначала предлагается в `DATA_MODEL.md`.
Только после утверждения меняются schema / migration / code.

---

## 3. Architecture decisions must be recorded

Каждое архитектурное решение записывать в `DECISIONS.md`:
дата, проблема, варианты, решение, причина, последствия.

**Незаписанное решение считается непринятым.**

---

## 4. Never guess business decisions

Если существует развилка, влияющая на: данные, деньги, бронирование, availability,
тариф, guest status, фискализацию, eQonaq, channel manager —
записать вопрос в `QUESTIONS.md`. Не придумывать ответ.
После этого перейти к задаче, не зависящей от вопроса.

---

## 5. External APIs only from project documentation

Для Channex, eQonaq, Smart Bridge, fiscal provider, Exely — использовать документацию в `/docs`.
Не писать integration code по памяти модели.

Если документация отсутствует или противоречит API — **STOP**, создать вопрос.

---

## 6. Red before green

Новый bugfix или business rule:

1. создать тест;
2. показать, что тест падает на существующем поведении;
3. исправить код;
4. показать, что тест проходит.

Тест, который никогда не был красным, не считается доказательством исправления.

---

## 7. Secrets

Запрещено выводить API keys, passwords, access tokens, passport data, payment credentials
в код, Git, logs, screenshots, chat.
Secrets — только через environment variables / secret storage. См. `SECURITY.md`.

---

## 8. No real guest data in tests

Все тестовые гости вымышленные. Запрещено копировать реальные ФИО, телефоны,
паспорта, email, карты, документы в fixtures, tests и prompts.

---

## 9. Production is read-only until cutover approval

До отдельного разрешения:

- Exely production не изменять;
- OTA production не изменять;
- Channex production ARI не отправлять;
- eQonaq production submissions не отправлять;
- fiscal production receipts не создавать.

---

## 10. Every slice needs evidence

Задача не закрывается словом "done". Нужно одно из:
passing test, screenshot, reconciliation report, API request/response из sandbox,
сравнение с Exely.

---

## 11. Never silently lose external events

Каждое внешнее событие (booking, modification, cancellation, payment, notification)
должно иметь: external ID, received_at, processing state, error state, retry state, audit trail.

---

## 12. Money is never float

Деньги хранить в integer minor units / decimal-safe representation.
Никаких JavaScript floating-point вычислений финансов.

---

## 13. Dates and timestamps are different

Stay dates — `DATE` в timezone объекта. События — UTC timestamp.
Не превращать check-in date в UTC datetime без явного правила.

---

## 14. No schema migration without rollback

Каждая production migration должна иметь: backup, migration, validation, rollback procedure.

---

## 15. Что агенту можно делать без надзора

**Можно:** импорт CSV, UI по утверждённой модели, тесты, refactoring, input validation,
error messages, accessibility, logging, documentation, reconciliation scripts, fixtures,
performance improvements.

**Нельзя:** менять data model, придумывать booking rules, выбирать fiscal provider,
выбирать eQonaq auth, впервые проектировать Channex integration, менять financial logic,
делать production migration, отправлять production ARI.

---

## 16. Scope discipline

MVP-границы зафиксированы в `SPEC.md`. Самостоятельно расширять scope запрещено —
даже если функция «очевидно полезная». Предложение — в `QUESTIONS.md`.

---

## 17. Одно рабочее дерево — одна сессия

В репозитории одновременно работает **один агент**. Причина не в удобстве, а в том, что
общих ресурсов три и все они не переживают двоих:

- **dev-база Supabase.** Пулер отдаёт 15 соединений. Два прогона на общей базе валят
  друг друга ошибкой `EMAXCONNSESSION: max clients reached in session mode`.
- **Отпечаток кода.** `tests/tools/cli-record.ts` считает хэш набора до и после прогона.
  Если сосед правил `apps/` или `packages/` в это время, прогон помечается
  «код набора менялся во время прогона» и как доказательство по §6 не засчитывается.
- **Индекс git.** Два `git add` в одном дереве затирают друг друга. 15.09.2026 миграция
  `20260915000013_accounts` так уехала в чужой коммит про шахматку, а
  `packages/domain/src/accounts/` дважды выпадал из индекса.

Отдельный `git worktree` проблему **не решает**: замок в `tests/runs/.locks/` привязан к
дереву, а база одна на всех. Две копии дерева просто снимут предупреждение и приведут к
ошибке пулера.

Правила:

1. Прежде чем начать работу, проверить `tests/runs/.locks/` и `git status`. Чужой замок или
   чужие незакоммиченные файлы в `apps/`, `packages/`, `scripts/` — ждать, не начинать.
2. Замок `dev-database.lock` руками **не удалять**. Он снимается сам по завершении прогона.
   Удаление замка не останавливает чужой прогон, а только убирает предупреждение.
3. Чужой прогон не прерывать. Если работа встала из-за него — сказать владельцу и ждать.
4. Правка документации (`*.md` в корне, `docs/`, `plans/`, `reports/`) отпечаток набора не
   меняет и разрешена всегда: `watchPathspec` исключает `NOT_CODE`.
