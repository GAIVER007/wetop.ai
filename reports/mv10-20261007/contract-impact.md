# MV10: impact report обязательного API-контракта

07.10.2026. AS-IS от main b6db018699fa806060d3e74f8d257ec57a9ff8c2 (MV9 merged). Код не изменён. Owner «давай далее» разрешает продолжение согласованного MV10, но не решает новую развилку публичного доступа к данным.

## Подтверждённая цепочка

- Python apps/ai-seller/src/channels/widget_runner.py:build_runner выбирает support/seller по bot_role, seller всегда получает hotel_tools.build_registry. Registry и CascadeClient собираются для процесса, а не vertical конкретного хода.
- agent_scope.py:AgentScope проверяет Agent.organization_id, но не возвращает canonical vertical/Business. db/models.py:Agent.location_id справочное зеркало, комментарий прямо называет платформу источником правды.
- integrations/wetop.py передаёт agent из dependencies.agent_id_var, а не LLM. Это верное существующее начало trust chain.
- Nest auth/auth.guard.ts:80 SELLER_QUOTE_ALLOWED содержит ровно /bot/availability и /bot/agent-origins, остальные адреса отвергаются. Контроллер bot-quote.controller.ts проверяет ключ независимо от AUTH_REQUIRED.
- web-booking.service.ts:quoteForAgent находит booking site агента и assertServingProperty, то есть это Hospitality quote contract, а не общий vertical capability context.
- Beauty scope.ts и Food scope.ts требуют hasSignedInActor и actorMay. Операторские GET нельзя открыть продавцу под service key через подмену user или общий scope.
- Beauty services() содержит каталог с active, price, enabled/overrides; customers() содержит персональные данные. Food reservations содержит данные гостей. Нет утверждённого публичного read DTO для этих данных.

## Почему это блокирует обязательный DoD

Без canonical binding/capabilities от платформы runtime не может достоверно выбрать реестр до LLM. Без узкой read-двери Beauty/Food не получают реальные tool outputs. Простое удаление hotel tools для них даст честную недоступность, но не завершит обещанный работающий MV10. Прямой вызов operator API сломает permission boundary. Ни один из вариантов не выдаётся за DoD.

## Предлагаемый минимальный контракт на согласование

Одна server-to-server дверь контекста, две узкие read-двери. Названия ниже предложение, endpoints ещё не существуют.

1. GET /bot/agent-context?agent=<UUID>
   Авторизация существующим SELLER_QUOTE_KEY, только GET, Cache-Control:no-store. Платформа по seller_agents выводит Organization -> active Business -> active Location -> canonical vertical, проверяет lifecycle/entitlement по действующим правилам. Запрос не принимает organization/business/location/vertical/toolset. Чужие binding chain/архивный/несуществующий агент: одинаковый отказ, без domain calls. Не использовать Python зеркало как authority.
   DTO: {agentId, organizationId, businessId, locationId, vertical, timezone, currency, capabilities:string[]}. Capabilities фиксированный серверный allowlist; никаких произвольных endpoint URLs. Идентификаторы server-only, не сериализуются в публичный ответ чата.
2. GET /bot/beauty-services?agent=<UUID>
   После той же цепочки только BEAUTY. Предложение публичного allowlist: действующие услуги, включённые в конкретном филиале, {name, category, durationMinutes, priceMinor:string, currency}. Цена считается действующим domain resolver филиала, не LLM. Это цена каталога, не сумма будущей записи или оплата. Никаких Employee/Customer, телефонов, appointments, расписания клиентов или финансовых отчётов.
3. GET /bot/food-service-periods?agent=<UUID>
   После той же цепочки только FOOD_SERVICE. Предложение allowlist: действующие периоды обслуживания филиала, название и уже сохранённые правила времени/длительности в его timezone. DTO: {name, weekday, timeFrom, timeTo, endsNextDay, defaultDurationMinutes}, timezone из проверенного контекста. Поля времени подтверждены packages/domain/src/food/food.ts:FoodPeriod; имя и active фильтр из ServicePeriod. Никаких гостей, reservations, столов, точного остатка мест, availability обещаний, финансов/POS.

Публичная допустимость активных услуг/цен Beauty и periods Food требует решения владельца: active/enabled операторской модели не равно автоматически разрешению опубликовать данные через AI. Если каталог не должен быть публичным, другой допустимый read-only инструмент нужно назвать отдельно. Дневные operator данные исключены из гостевого продавца.

Hospitality contract и инструменты остаются прежними. Support assistant отдельно. Контекст проверять для текущего хода и повторно перед выполнением domain tool, не доверять cached registry или arguments. Нет process-global смены registry для всех агентов. Недоступная платформа => fail closed, без гостиничного fallback. Mutations, public booking и финансовые действия Beauty/Food вне этого разрешения.

## Impact и доказательства после разрешения

Nest: отдельный bot vertical module/service, agent binding resolver, точечное расширение service-key GET allowlist, no-store, ограниченный DTO и audit без PII/secrets. Python: provider read methods, typed context, registry per turn, separate Beauty/Food tool adapters, mock LLM. Web: shared agent screen с capabilities/binding по проверенному серверному контексту, не service-key дверь из браузера.

Schema/migrations и новые env keys не требуются по предложению. Не менять permission matrix operator endpoints, entitlement semantics, booking или financial rules. Если audit binding lifecycle выявит недостающую модель, отдельный DATA_MODEL impact до её изменения.

Tests: RED/GREEN context and dispatch, cross-vertical/tool/agent/Location/Organization denial before provider calls, bad keys under both AUTH_REQUIRED modes, lifecycle/archive/entitlement changes between context and tool, concurrent different vertical agents, unknown adapter and malformed output. Real private API/DB/browser, fake LLM without paid calls. Full applicable suites и Hospitality regression. После отдельного PR STOP, no merge/production/MV11.

## Текущая остановка

Реализация остановлена на новом контракте и правилах публикации каталога. Это не отказ из-за сложности: действующий service contract запрещает нужные вызовы и не отдаёт canonical toolset context. Не расширяем его молча. Согласование этого предложения разблокирует MV10 без schema/migrations.

## Решение владельца

07.10.2026: «Утверждаю этот контракт». Публичные каталоги Beauty/Food и три узкие read-only двери разрешены. Соответствующий блокер снят.
