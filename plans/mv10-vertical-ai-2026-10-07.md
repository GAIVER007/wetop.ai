# MV10: vertical AI tools, утверждённый план

Дата: 07.10.2026. Статус: APPROVED. Владелец разрешил переход к MV10 07.10.2026 «давай далее» и отдельно утвердил минимальный backend-контракт через вопрос согласования.

## Проверенная база

Fresh main b6db018699fa806060d3e74f8d257ec57a9ff8c2, MV9 PR269 MERGED. Использован чистый собственный checkout MV9, shared checkout и БД не затронуты.

Master plan plans/multi-vertical-platform-2026-10-04.md §§2,9 требует server-selected toolset, trusted agent binding и отказ чужим Business/Location/tool до domain calls. Knowledge/channels/test UI общие. Hospitality сохраняется.

Реестр Python существует: apps/ai-seller/src/ai/tools.py, ToolRegistry. Hotel tools существуют: hotel_tools.py, availability/price и optional seller_booking. LLM использует registry через ai/llm.py. Support tools отдельные, их нельзя автоматически смешивать с клиентским продавцом.

Nest BusinessAgentsService.create уже проверяет роль, entitlement, scope и активную Organization/Business/Location цепочку (business-agents.service.ts, repository.ts). Наличие этого binding при создании не доказывает его корректную передачу в каждый runtime-вызов. Это обязательный первый аудит MV10. Отсутствие Beauty/Food адаптеров нельзя заменять гостиничными tools.

## Предлагаемый scope

1. Зафиксировать матрицу каждого действующего agent entrypoint: источник identity, Business/Location binding, vertical, permissions/entitlement, factory реестра, provider и API boundary. Определить точные DTO до кода. Записать ADR.
2. Сервер выбирает реестр по проверенному Business.vertical и активному Location. Ни prompt, ни browser, ни аргументы tool не меняют identity/scope/vertical. Missing/invalid/foreign/archive binding закрывает domain tools.
3. Hospitality: сохранить действующие availability, price и уже разрешённые booking tools, покрыть регрессию. Support assistant остаётся отдельным продуктовым контекстом.
4. Beauty/Food первый срез read-only: по отдельно утверждённому контракту только активные включённые услуги Beauty с ценами/длительностью и активные периоды Food. Дневные операторские данные, PII и отчёты исключены. Адаптеры отдельны. Истечение entitlement и недоступный адаптер дают честную недоступность.
5. Общий UI знаний/каналов/тестов отображает binding и capabilities выбранного агента, скрывает устаревший результат при переключении. Не обещает неподключённые каналы или online booking.
6. Red/green: чужой Business/Location/tool, tampered prompt/arguments, архивный binding, parallel agents с разными scope, повторный запрос и смена ветки. Проверять отсутствие domain/provider calls при отказе, а не только код HTTP.
7. Real sandbox API/DB/browser matrix трёх вертикалей плюс Python runtime tests с fake LLM. Focused/full unit, integration, typecheck, lint, build, Hospitality regression, axe/keyboard/mobile и evidence. Платные LLM и внешние production calls не нужны.
8. Commit/push, отдельный PR MV10, затем STOP. Merge, deploy, production/release и MV11 не входят.

## Явные границы и решения до реализации

Read-only Beauty/Food и публичное чтение активных услуг Beauty с ценами и периодов Food утверждены владельцем. Гостевые записи и персональные данные не публикуются. Запись/перенос/отмена appointments/reservations и public availability не добавляются автоматически: требуют отдельной матрицы permissions, booking semantics и согласования. Нет generic booking domain, Food finance/POS, депозитов или новых финансовых правил.

Новый backend contract допускается только после описания DTO, trust chain и impact. Schema/migrations не предполагаются; если действующий agent binding реально недостаточен, остановить соответствующий срез с точным impact report и model amendment до кода.

DoD: сервер определяет и исполняет только допустимые инструменты связанного Business/Location; malicious tool calls не достигают чужого domain; реальные sandbox outputs подтверждены; Hospitality сохранён; недоступные функции честно gated; полный отчёт и отдельный PR.

Утверждённый контракт и impact: ../reports/mv10-20261007/contract-impact.md. Изолированный checkout /Users/urijzapojnov/wetop-mv10-20261007, branch codex/mv10-vertical-ai-20261007. Отдельная PostgreSQL 16 UTF8: /Users/urijzapojnov/wetop-mv10-runtime-20261007/pgdata, порт 56093. Browser API/Web: 56094/56095, Hospitality regression: 56103/56104.
