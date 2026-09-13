# Зависимости проверки UI

13.09.2026. Для автоматической проверки доступности добавлен только dev-инструмент `@axe-core/playwright` и его `axe-core`; состав runtime-зависимостей приложения не менялся.

`npm audit --json` показал 11 уведомлений (9 high, 2 moderate) в уже существующих цепочках. Это число пакетов, включая транзитивные агрегаты, а не 11 независимо достижимых уязвимостей. Полный security-аудит приложения этим документом не заявляется.

| Цепочка | Условие / проверенное использование | Решение в этой работе |
|---|---|---|
| Nest → multer 2.2 | DoS на multipart upload. В `apps`/`packages` нет импортов multer или Nest FileInterceptor/FilesInterceptor/FileFieldsInterceptor/AnyFilesInterceptor | Нет подтверждённого пути из HTTP приложения в уязвимый multipart parser. Проверить совместимое обновление multer/Nest; не применять предложенный npm audit откат Nest на 7.x |
| Prisma config → deepmerge-ts 7.1.5 | DoS на рекурсивном графе. Prisma config получает объект из доверенного файла `packages/database/prisma.config.ts`; HTTP-данные туда не поступают | Не делать major override deepmerge-ts внутри Prisma при UI-изменении |
| Prisma tooling → mysql2 3.15.3 | Auth downgrade / compressed-packet DoS при соединении с MySQL | PMS настроен на PostgreSQL; MySQL/Studio в этой работе не запускались. Обновление vendor-цепочки требует отдельной проверки |
| Prisma Studio/visx → lodash 4.17.21 | Уязвимые template/unset/omit. Прямых вызовов lodash в приложении нет | Не утверждается безопасность Studio как публичного сервиса; проверить vendor patch отдельно |
| ExcelJS → uuid 8.3.2 | Уязвимые варианты и пользовательский output buffer | Проверены два использования ExcelJS: только `v4()` без пользовательского буфера; описанный advisory-вектор здесь не используется |

Автоматический `npm audit fix --force` не запускался: он предлагает несовместимые перестановки Prisma/Nest и не подходит для проверки frontend. Дата повторного анализа совместимых vendor-обновлений: 20.09.2026. Это запись оставшейся работы, не созданное напоминание или automation.
