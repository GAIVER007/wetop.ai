# VideoSDK Telephony и Agents SDK: выжимка документации

Сверено 22.10.2026 по https://docs.videosdk.live/telephony/ (страницы introduction, ai-telephony-agent-quick-start,
call-routing/routing-sip-calls-to-agent, managing-calls/handling-calls, sip-webhooks, call-transfer, dtmf-events)
и https://docs.videosdk.live/ai_agents/core-components/agent. Пример-основа: репозиторий
`videosdk-community/ai-telephony-demo` (MIT), 54 строки `main.py`.

Правило AGENTS.md §5: код интеграции пишется только по этому файлу. Чего здесь нет, того мы не знаем (см. раздел
«Не подтверждено документацией»).

## Схема

```
Телефон -> SIP-провайдер -> Inbound Gateway VideoSDK -> Routing Rule -> комната VideoSDK + агент (наш воркер)
```

- SIP-провайдер даёт номер и транк (в документации: Twilio, Vonage, Plivo, Telnyx). Входящие он пересылает на
  `sip:<ORG_ID>.sip.videosdk.live`; регион можно закрепить (`in1`, `us2`).
- Создание номера через `POST /v2/sip/phone-numbers` заводит сразу входящий и исходящий шлюзы. Тело: `name`,
  `phoneNumbers` (E.164), `inbound.sipRegion`, `outbound` (`sipRegion`, `address`, `transport`, `auth`).
- Routing Rule выбирает, что делать со звонком. Для агента `dispatch.agent` = `{type: "self", id: "<agentId>",
  metadata: {...}}` (свой воркер) или `{type: "cloud", id: "<deployment id>"}`. Комната: `dynamic` (новая на каждый
  звонок, префикс `random`, `participantNumber` или `SIP number`) или `static`.
- Исходящий звонок: `POST https://api.videosdk.live/v2/sip/call` с `sipCallFrom`, `sipCallTo` (E.164),
  `routingRuleId` (правило типа outbound), необязательно `destinationRoomId`. В README демо тело проще:
  `gatewayId` и `sipCallTo`. Какая форма актуальна, подтвердит пробный звонок.
- Авторизация REST: заголовок `Authorization: <VideoSDK token>`.

## Воркер (Agents SDK, Python 3.12+)

- Пакеты: `videosdk-agents`, `videosdk-plugins-google` (режим Realtime), `python-dotenv`. Демо пинит `>=1.0.10`.
- `Agent(instructions=..., tools=[...])`, хуки `on_enter` и `on_exit`, `self.session.say(text)`.
- Инструменты: декоратор `@function_tool` на функции или методе, описание берётся из docstring. Есть `MCPServerStdio`.
- Realtime: `Pipeline(llm=GeminiRealtime(model="gemini-3.1-flash-live-preview", api_key=..., config=GeminiLiveConfig(
  voice="Leda", response_modalities=["AUDIO"])))`.
- Запуск: `WorkerJob(entrypoint=start_session, jobctx=make_context, options=Options(agent_id=..., register=True,
  max_processes=10, host=..., port=...)).start()`. `agent_id` обязан совпасть с `dispatch.agent.id` правила.
- `await session.start(wait_for_participant=True, run_until_shutdown=True)`.
- Переменные окружения: демо читает `VIDEOSDK_API_KEY`, `VIDEOSDK_SECRET_KEY`, `GOOGLE_API_KEY`; страница
  quick-start: `VIDEOSDK_AUTH_TOKEN`. Для облачного агента добавляются `VIDEOSDK_ROOM_ID` и `VIDEOSDK_TOKEN`.

## События и управление звонком

- Вебхуки SIP (`POST /v2/sip/webhooks`, тело `url`, `events`): `call-started`, `call-answered`, `call-hangup`,
  `call-missed`, `call-ringing`, `call-update`, `call-transferred`, `call-transfer-initiated`,
  `call-transfer-accepted`, `call-transferring`, `call-transfer-ringing`, `call-transfer-failed`.
- Перевод на человека: `POST /v2/sip/call/transfer` с `callId` и `transferTo` (номер или SIP URI), через SIP REFER.
  Для Twilio в транке включается «Transfer to PSTN».
- DTMF: включается флагом `enableDtmf` шлюза, события приходят в PubSub по теме `DTMF_EVENT`, цифра в
  `payload.number`.

## Не подтверждено документацией (проверять пробным звонком, не угадывать)

1. Как `dispatch.agent.metadata` попадает в воркер (поле `JobContext`, переменная окружения или другое).
   Без этого воркер не знает, чей это звонок. До подтверждения идентичность берётся из таблицы
   «номер -> агент», которую ведёт сам воркер (см. `voice-channel.md`, раздел «Идентичность звонка»).
2. Откуда в воркере взять `callId` для перевода звонка и номер звонящего.
3. Подпись вебхуков SIP: в проверенных страницах не описана. Пока не описана, вебхук не считается доверенным
   источником для денег и статусов, он только дополняет журнал.
4. Цены минут, лимиты одновременных звонков и номера в Казахстане: документация не отвечает, это вопрос владельцу.
5. Тариф и политика хранения записи разговора.
