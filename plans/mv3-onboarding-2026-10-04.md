# MV3: общий onboarding framework

Основание: владелец принял MV2 и разрешил MV3 04.10.2026. MV2 PR #239 merged, SHA a4fac4b68acbc8f6d84e1c2350c5060a4832fa32. Перед merge base a389af69 и head 4a420908 совпали с проверкой владельца, mergeable, comments/reviews пусты.

## Срезы

1. Canonical registry определяет flow только из server-resolved Business.vertical. Не принимать vertical из URL или сохранённого черновика как источник прав.
2. Shared engine: версия flow, ordered steps, next/back, разрешённый skip, draft/resume. Hospitality adapter сохраняет существующие категории, номера/койки и тариф; Beauty/Food имеют только Business/Location/timezone/currency и честное завершение пилота.
3. API получает explicit verified Business/Location context для новых flows. Проверяет active chain, organization, роль; READ_ONLY не сохраняет. Клиент не передаёт tenant ownership. Hospitality legacy no-scope остаётся только прежней совместимостью.
4. Общий UI shell: прогресс, назад/продолжить, сохранение, обработка ошибок. Beauty: «Пилот Beauty подключён. Настройку услуг и сотрудников продолжим после активации модуля.» Food: аналогичное сообщение без неработающих domain шагов.
5. Red/green: registry и переходы, scoped persistence, cross-business denial, wrong vertical URL, READ_ONLY denial, Hospitality regression. Локальная изолированная БД, без общего Supabase. Затем browser reload, keyboard, axe, 1440/390 light/dark.
6. Отчёт, commit/push, review PR и STOP. MV4 не начинать. Production и реальные allowlists не менять.

## Хранение, утверждено владельцем 04.10.2026

Существующие Business/Location не имеют onboarding state; WizardDraft принадлежит другому AI seller workflow и не переиспользуется. Предлагается OnboardingProgress на Location (one-to-zero-or-one), версия flow, currentStep, ограниченный валидированный draft, completedAt/updatedAt. Vertical не дублируется. Scope/RLS выводится по Location -> Business -> Organization. Черновик не создаёт domain данные; завершение adapter применяет проверенные shared данные атомарно.

Владелец подтвердил серверную OnboardingProgress. Локальный browser draft не используется как источник сохранённого прогресса.

## Границы

Не создавать Beauty services/employees/appointments/calendar, Food dining areas/tables/reservations/floor plan, Today или analytics. Существующий Beauty код не означает разрешение включить его в MV3 onboarding. Domain extension points доступны последующим MV4/MV6.

## Контракт реализации

`GET /onboarding`: authenticated self, explicit active Location + Business + organization, returns server vertical, flowVersion/currentStep, draft, completedAt/updatedAt, canEdit. `POST /onboarding`: settings permission плюс действующее право записи организации; только action/draft/updatedAt. Клиентские vertical, Business/Location IDs в body отвергаются. Next/back вычисляются registry, currentStep клиент не назначает.

Location row lock сериализует первую вставку и последующие обновления, updatedAt служит optimistic concurrency token. Устаревшая вкладка получает 409 и не перезаписывает данные. Draft ограничен 64 KiB на уровне БД и валидируется adapter. Shared completion атомарно обновляет существующие Business/Location и progress, пишет audit. Завершённый flow повторно не применяет данные. Currency/timezone существующего операционного филиала не переписываются onboarding.

Browser entry `/register/setup` не запускает Hospitality shell для пилотов. Вертикаль query игнорируется. Existing `/onboarding` перенаправляет туда только при explicit verified scope; legacy Hospitality без scope остаётся прежним flow. Registration completion helper не используется для выбора Business внутри setup.
