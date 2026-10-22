**22.10.2026, ветка `claude/voice-agent-20261022`: голосовой агент (ИИ-колл-центр), этапы 0 и 1.**

Поручение владельца: добавить в продвижение раздел «Голосовой агент» на основе `videosdk-community/ai-telephony-demo` и довести до рабочего состояния. Владелец принял все умолчания плана.

Что сделано:

- этап 0 (документы): `docs/voice/videosdk-telephony.md` (выжимка документации, AGENTS.md §5), `docs/voice/voice-channel.md` (проект канала), `docs/decisions/2026-10-22-voice-agent.md`, вопросы Q-VOICE-1..7 в `QUESTIONS.md`, предложение `VoiceCall` в `DATA_MODEL.md` (VOICE-20261022, НЕ утверждено, миграций нет);
- этап 1 (код): пакет `apps/ai-seller/voice/` (номера, маршрут из `dispatch.agent.metadata`, журнал JSONL, профиль и инструкции, клиент каталога WETOP, инструменты `get_services`, `request_callback`, `transfer_to_human`, настройки, агент и воркер на VideoSDK Agents SDK 1.0.26);
- по установленному SDK подтверждено: `JobContext.metadata` несёт metadata правила маршрутизации, `AgentSession.call_transfer(номер)` переводит звонок без `callId`. Q-VOICE-7 сужен до проверки пробным звонком.

Проверки: `python -m pytest voice/tests` из `apps/ai-seller`: 73 passed на Python 3.14 с SDK; 70 passed и 1 skipped без SDK. Ядро текстового продавца не тронуто. Тесты части 70 дописаны вместе с кодом (маршрут по metadata): красными до кода были тесты номеров, журнала, профиля, клиента, инструментов и настроек.

Не сделано и не проверено:

- пробный звонок: нужны ключи VideoSDK и Google, тестовый номер и правило маршрутизации (делает владелец), воркер с реальным SDK не запускался;
- голос в `release-checks` не включён (тесты лежат в `apps/ai-seller/voice/tests`, отдельный шаг гейта не заведён);
- этап 2: раздел `/marketing/voice` в стойке и API чтения журнала; требует отдельного плана и решения по хранению (Q-VOICE-4, DATA_MODEL VOICE-20261022);
- Q-VOICE-1 (оператор SIP и расходы), Q-VOICE-2 (юридические условия записи) закрыть до боевого запуска.
