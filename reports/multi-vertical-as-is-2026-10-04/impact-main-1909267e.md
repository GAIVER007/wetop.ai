# Impact report: main 1909267e, 04.10.2026

Read-only сравнение 8e2d7036f..1909267e выполнено в существующем checkout другой сессии /Users/urijzapojnov/wetop-channex-recovery-20261004. Это только чтение, новый worktree не создан. Наш основной checkout не обновлялся: чужие незакоммиченные файлы сохраняются. Сессия «Подключить репозиторий wetop.ai» активна, заканчивает CI/выкладку. Условия clean tree/foreign work finished пока не выполнены.

## Изменения, влияющие на MV1

1. Business.vertical в проверяемой версии остаётся HOSPITALITY | BEAUTY, расположение на Business сохранено. FOOD_SERVICE ещё нужно добавить.
2. RequestActor расширен integrationPropertyId; добавлены withIntegrationPropertyScope/currentIntegrationPropertyId. Это отдельный доверенный контекст фонового Channex job. MV1 должен сохранить его и проверять Property → Location → Business для service capability, не требуя человеческой сессии. auth/scope.ts в этом сравнении не изменён.
3. Channels boundaries существенно изменились: 33 файла, multi-property mapping/routing, webhook/outbox/sync, guard доступа организации. ChannelOrganizationGuard проверяет наличие Property организации, но не выбранный Business.vertical. В mixed Organization гостиничный Property сам по себе не подтверждает разрешение Beauty Business на гостиничный endpoint. MV1 нужен явный тест этого случая и отдельные service/public binding tests.
4. В main уже появилась Beauty schema: Customer + CustomerBusiness, Employee и связки, BeautyService, WorkingHours, TimeOff, Appointment. Следовательно прежний AS-IS «Beauty tables не реализованы» устарел для нового main. Создавать их повторно нельзя, а roadmap MV4 требует нового аудита фактического domain/API слоя.
5. Appointment имеет default BOOKED; в schema не найдены IN_PROGRESS и bufferBefore/bufferAfter. Это расходится с принятым здесь Beauty v1 (SCHEDULED/CONFIRMED/IN_PROGRESS/COMPLETED/CANCELLED/NO_SHOW и buffers). В MV1 Beauty schema не переписывать; reconciliation модели и прежних ADR вынести перед Beauty-срезом.

## Вывод

Каноническая иерархия сохраняется, но RequestActor и channels boundaries изменены, срабатывает установленное владельцем условие «сначала impact report, без кода». Реализация MV1 не начата. После завершения соседней работы потребуется согласовать этот impact, актуализировать AS-IS по stable main, сохранить наши документы отдельно и получить чистое дерево без удаления чужих файлов. Ни миграции, ни тесты, ни routes, ни production не изменены этой сессией.
