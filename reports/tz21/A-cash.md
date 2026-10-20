# ТЗ2.1 A: касса

База0766123dbb71f660c2346196a5f9841e14cb2142. Product: shared cashbox action, прежний restaurant action только adapter; CashBoard импортирует нейтральный путь. Restaurant menu/order guard не расширен.

RED:2026-10-17T06-30-30Z-unit-d643, исходная салонная команда отклоняется ресторанным scope. GREEN:2026-10-17T06-53-34Z-unit-fbbb,9/9 unit.

Реальный контур: Browser -> Next33745 -> AppModule API33744 -> PostgreSQL55743/wetop_tz21/pms_test. Session получена настоящим /auth/login. Tenant requests выполняются wetop_app, НЕ superuser, НЕ BYPASSRLS. LOGIN разрешён только этой существующей технической роли внутри собственного synthetic cluster. Пользовательские роли и auth код не менялись. Transport сообщений заменён на отказ в harness, внешних сообщений нет.

8 браузер/API cases: Beauty/Food UI приход123тенге, reload, сохранённые12300minor/KZT; same-key replay возвращает тот же id, changed payload409; STAFF void403, чужая организация403 и данные неизменны; два случая stale формы после переключения филиала отклонены без записи и потери введённой суммы. DB join подтвердил location,amount,currency,status и payment_write_intents.result_id на ту же source cash operation для обеих UI-команд.

Важно: idempotency протестирована в существующем режиме EXPENSE_LINKS_ENABLED=1 с уже существующей held114, применённой только к собственной БД. Этот change не активирует флаг и не применяет held migration вне стенда. Никакой новой таблицы/миграции в патче нет. При выключенном существующем флаге данный пакет не обещает новую backend идемпотентность. UI сохраняет прежний ключ и не повторяет неопределённый результат автоматически с новым ключом.

Источник A-real-ui-api.json и A-stale-context.json, отдельные screenshots в deliverable package. Полная приёмка гостиничного пути и type/lint/build выполняются на окончательном объединённом коде.
