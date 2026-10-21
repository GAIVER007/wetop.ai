# Проверки и Git

Эти записи различают промежуточные и окончательные результаты. Полные команды, SHA, fingerprint и dirty paths сохранены в JSON каждого прогона. Логи тестов используют синтетические данные.

| Прогон | Результат | Счётчики | Код менялся во время прогона | Запись / лог |
|---|---|---|---|---|
| 2026-10-11T19-30-14Z-e2e-f2bb | failed | total=1, passed=0, failed=1, skipped=0, flaky=0 | True | [JSON](../../tests/runs/entries/2026-10-11T19-30-14Z-e2e-f2bb.json) / [log](../../tests/runs/logs/2026-10-11T19-30-14Z-e2e-f2bb.log) |
| 2026-10-11T19-32-38Z-e2e-d754 | failed | total=12, passed=10, failed=2, skipped=0, flaky=0 | False | [JSON](../../tests/runs/entries/2026-10-11T19-32-38Z-e2e-d754.json) / [log](../../tests/runs/logs/2026-10-11T19-32-38Z-e2e-d754.log) |
| 2026-10-11T19-36-50Z-e2e-2d8c | failed | total=1, passed=0, failed=1, skipped=0, flaky=0 | False | [JSON](../../tests/runs/entries/2026-10-11T19-36-50Z-e2e-2d8c.json) / [log](../../tests/runs/logs/2026-10-11T19-36-50Z-e2e-2d8c.log) |
| 2026-10-11T19-38-32Z-e2e-cfc9 | passed | total=20, passed=20, failed=0, skipped=0, flaky=0 | False | [JSON](../../tests/runs/entries/2026-10-11T19-38-32Z-e2e-cfc9.json) / [log](../../tests/runs/logs/2026-10-11T19-38-32Z-e2e-cfc9.log) |
| 2026-10-11T19-42-45Z-unit-1a71 | passed | total=72, passed=72, failed=0, skipped=0, flaky=0 | False | [JSON](../../tests/runs/entries/2026-10-11T19-42-45Z-unit-1a71.json) / [log](../../tests/runs/logs/2026-10-11T19-42-45Z-unit-1a71.log) |
| 2026-10-11T19-44-55Z-lint-1823 | passed | без счётчиков | False | [JSON](../../tests/runs/entries/2026-10-11T19-44-55Z-lint-1823.json) / [log](../../tests/runs/logs/2026-10-11T19-44-55Z-lint-1823.log) |
| 2026-10-11T19-45-07Z-typecheck-a3c5 | passed | без счётчиков | False | [JSON](../../tests/runs/entries/2026-10-11T19-45-07Z-typecheck-a3c5.json) / [log](../../tests/runs/logs/2026-10-11T19-45-07Z-typecheck-a3c5.log) |
| 2026-10-11T19-47-54Z-e2e-9648 | failed | total=2, passed=1, failed=1, skipped=0, flaky=0 | False | [JSON](../../tests/runs/entries/2026-10-11T19-47-54Z-e2e-9648.json) / [log](../../tests/runs/logs/2026-10-11T19-47-54Z-e2e-9648.log) |
| 2026-10-11T19-49-19Z-unit-659e | failed | total=4568, passed=4563, failed=1, skipped=4, flaky=0 | False | [JSON](../../tests/runs/entries/2026-10-11T19-49-19Z-unit-659e.json) / [log](../../tests/runs/logs/2026-10-11T19-49-19Z-unit-659e.log) |
| 2026-10-11T19-54-29Z-unit-2703 | passed | total=15, passed=15, failed=0, skipped=0, flaky=0 | False | [JSON](../../tests/runs/entries/2026-10-11T19-54-29Z-unit-2703.json) / [log](../../tests/runs/logs/2026-10-11T19-54-29Z-unit-2703.log) |
| 2026-10-11T19-55-29Z-e2e-24b9 | interrupted | total=17, passed=0, failed=5, skipped=12, flaky=0 | False | [JSON](../../tests/runs/entries/2026-10-11T19-55-29Z-e2e-24b9.json) / [log](../../tests/runs/logs/2026-10-11T19-55-29Z-e2e-24b9.log) |

## Интерпретация

- 19-30: невалидное RED из-за изменения nested Claude-инструкций; заменено чистым RED19-47.
- 19-32: 10/12, панель исправлена и переключатель прошёл, два таймаута сохранены.
- 19-36: диагностический testid нового loader, не доказательство отсутствия исходной загрузки.
- 19-38: 20/20 на промежуточном loader, который затем отменён. Карточка брони проверена10 сценариями.
- 19-42:72/72 targeted unit, все три исходные проблемные области прошли.
- 19-44 и19-45:lint и typecheck прошли.
- 19-47:чистое RED панели и успешный неизменённый тест /hotel-settings на исходной заглушке.
- 19-49:full unit с единственным ENOENT из-за unstaged deletion;19-54:15/15 после внесения удаления в индекс.
- 19-55:прерванный финальный UI,5 failed и12 not run. Не считать GREEN.
- 20-04: full unit завершён, 4557 passed, 7 failed, 4 skipped; все семь сбоев являются превышением 5000 мс. codeChangedDuringRun=false. [JSON](../../tests/runs/entries/2026-10-11T20-04-00Z-unit-68b1.json), [лог](../../tests/runs/logs/2026-10-11T20-04-00Z-unit-68b1.log).

## Состояние серии

| Этап | Реализовано | Проверено | Перенос этой сессией в main |
|---|---|---|---|
| UI3.1 | Оболочка локально, правая сводка убрана, нормативные документы согласованы | Частично; финальная UI-приёмка открыта | Нет |
| UI3.2 | Только план/контракт и dependency map | Аудит исходников | Нет |
| UI3.3 | Только подробный план | Аудит зависимостей | Нет |
| UI3.4 | ТЗ получено, выполнение не начато | Нет | Нет |

Merge, push, deploy не выполнялись. Полный серверный integration/tenant suite и production build не запускались.

## Локальные коммиты

- 53e7484: две Bash-интерполяции и пакетная проверка журнала.
- 541c83e: существующая нормативная документация.
- f5a6ae523468cf0a8ef6475985efda803aeaa635: удаление постоянной сводки и UI-тесты.

[Полный diff относительно e523f35](changes.patch). Проверки выполнялись до финального коммита с указанными в JSON SHA и fingerprint рабочего состояния. Зелёный полный прогон финального SHA не заявляется. Отчёты и evidence-файлы остаются локальными, вне коммитов.
