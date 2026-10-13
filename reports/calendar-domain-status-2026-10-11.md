# Календарь: состояние выкладки 11.10.2026

Календарь и подтверждения объединены: [PR 263](https://github.com/GAIVER007/wetop.ai/pull/263), merge 02f86ca814bf3838ace1ff966e57f81043c30ff4. Актуальные названия поиска и уборки в тестах: [PR 399](https://github.com/GAIVER007/wetop.ai/pull/399), merge e8c2d059211cee7d4dc7fd048b81fd746af6243a. Обе вершины входят в текущий main 9dc9d43b58c3a0570a16c1a2fc0a7ab530bcfc31.

Локальные доказательства: 33/35 интегрированных UI passed; два дефекта ширины исправлены и повторно проверены на 1280/1366/1440, месяц на 768/812/1024/1280/1440/1920. Workspace 3/3, slow-inventory 1/1, актуальные названия 3/3; design guards 61/61, итоговый guard 18/18. TypeScript root/API/web, scoped ESLint и production build: exit 0. Реальные API readback и 26/26 сквозных на собственной PostgreSQL подтверждены в reports/calendar-confirmations-2026-10-08/README.md. Новые skips, сниженные assertions и baseline не добавлены.

На e8c2d059 гейт 38130667974 подтвердил 985 integration passed (16 прежних skipped), 4 проверки мастера и 26 сквозных; unit, сайт, бот, branches/beauty/food зелёные. Полный UI не завершился: новое слияние в main автоматически отменило прогон. На 0491010d UI 3/3 дал 411 passed, 3 failed из-за прежних названий, исправлено PR 399 с локальным RED/GREEN.

Четыре прогона main прерваны следующими слияниями: 38128058748, 38128374397, 38130667974, 38131944093. Причина: release-checks.yml concurrency cancel-in-progress=true. Последний гейт [38132582208](https://github.com/GAIVER007/wetop.ai/actions/runs/38132582208) выполняется на 9dc9d43b. Для завершения нужен полный прогон без новых слияний в main; запрос владельцу передан.

На домене пока прежняя версия: release и /var/lib/wetop-deploy/deployed = 12a6c3ba3f66e83272e449816e9ef6a6a672b455. Web/API healthy, публичный вход app.wetop.ai/auth/fallback HTTP 200. Выкладку календаря не считать выполненной. Release руками не перематывался.

Production schema не менялась. Единственная миграция в разнице release/main, 20261010000083_registration_country_locale, уже применена: повторный read-only SELECT подтвердил finished_at и совпадение checksum. После зелёного exact-SHA гейта auto-release перемотает release; если сервер откажет только на этой уже применённой миграции, подтвердить её штатным --migrations-applied для точной вершины (docs/deploy.md). Новые/отличающиеся миграции не применять.

После выкладки проверить deployed SHA, образы/BUILD_ID, внутренний health и совпадение SHA256 публичных CSS/JS календаря с файлами контейнера. Скрипт проверки подготовлен: /tmp/wetop-calendar-static-audit.mjs. Браузер внутри аккаунта требует входа владельца: встроенная вкладка находится на app.wetop.ai/auth/fallback; пароль в чат не запрашивался. Production-оплаты, возвраты и заселения для проверки не проводились.

Исходный общий checkout WETOP, чужой индекс, locks и процессы не изменены. Работа выполнялась в WETOP-calendar-ui-20261008, UI использовал собственные порты 4397/3197, сквозные собственную PostgreSQL 5497.
