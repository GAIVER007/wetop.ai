# M4-B2: оставшиеся проверки и публикация

18.10.2026. Владелец поручил завершить план, push/merge в main и работать до публикации. Это заменяет прежнюю границу «только draft PR» для кода этого среза. Условие «production-миграцию выполняет владелец» пока сохраняется.

1. Зафиксировать финальные unit/реестр маршрутов (83/83 уже прошли), typecheck корня/API/web и lint. Исправить только выявленные ошибки.
2. Повторить integration на свежем main: RLS/rollback, runtime/retention и 6 настоящих FK-race; 50 000 строк с замером обработки, undo и очистки содержимого/receipt-хэшей.
3. Браузер: OWNER импорт/повтор/reload/undo, восстановление UPLOADING, STAFF локальный preview и M4-A. Проверить 375/768/1440, axe, сохранить скриншоты. Закрыть ранее обнаруженные таймауты каталога повторной проверкой с достаточным временем запуска.
4. Итоговый diff-review и отчёт с точными журналами. Commit/push собственной ветки, PR с проверкой текущего SHA и прав. После зелёных локальных обязательных проверок merge в main согласно новому поручению.
5. Дождаться release-checks на точном main SHA. Красный гейт чинить, release вручную не перематывать. Не обходить гейт.
6. Подготовить и проверить production preflight: контекст сервера, текущий deployed SHA/образы/health, backup и ожидаемая миграция132. Production-миграция требует сохранённого разрешения владельца либо его выполнения.
7. Подтвердить автоматическое продвижение release и серверную выкладку точного проверенного SHA. При ожидаемой миграционной остановке получить её подтверждение и только затем migrations-applied.
8. Проверить рабочий app.wetop.ai: финальный URL, страницу клиентов под OWNER и права, отсутствие ошибок, наличие нового импорта. Production не использовать для импорта реальных или тестовых клиентов без отдельного разрешения на запись.

Готовность: изменения доступны на рабочем адресе; SHA и health подтверждены; локальные проверки и точный GitHub gate зелёные. Push, merge и HTTP200 отдельно публикацию не доказывают. Публичный marketing site не менялся в M4-B2; обновляется рабочая платформа.

## Блокер release-checks 39141813995: широкая шапка

1. Сохранить проверку страницы филиалов при ширине 1440 px.
2. Проверять утверждённый контракт шапки от 1280 px: кнопка «Открыть меню» отсутствует в доступном интерфейсе, навигация «Главное меню» видима.
3. После завершения общей интеграции запустить целевой браузерный сценарий через обязательный журнал тестов.

## Linux visual references

CI run 39141813995 failed on four header-only visual differences after the approved WETOP.AI shell update. Reviewed all four diff images: states and confirm-dialog, light and dark. Generate references using the canonical ui-snapshots workflow on merged branch commit 007cb37b0 (run 39144677100). Accept only the four reviewed files; preserve the 0.002 comparison threshold and all component assertions. Validate the final revision through release-checks before publication.
