# Голосовой воркер (ИИ-колл-центр)

Проект и ограничения: `docs/voice/voice-channel.md`. Документация VideoSDK: `docs/voice/videosdk-telephony.md`.

## Запуск (Python 3.12+, из `apps/ai-seller`)

```bash
python3.12 -m venv .venv-voice && source .venv-voice/bin/activate
pip install -r voice/requirements.txt
cp voice/env.example .env   # значения вписывает владелец, в git не попадают
python -m voice.worker
```

Дальше в панели VideoSDK: номер и шлюзы, правило маршрутизации `dispatch.agent` = `{type: "self", id: <VOICE_AGENT_ID>,
metadata: {organization_id, agent_id}}` (README демо, раздел Connect Your AI Phone Agent).

## Очередь событий

События звонков уходят в API платформы через очередь на диске (`VOICE_OUTBOX_DIR`). Если платформа была недоступна при выходе
воркера, догнать очередь можно командой (из `apps/ai-seller`):

```bash
python -m voice.flush
```

Код выхода 2 значит, что в очереди ещё остались события. Флаг `--requeue-rejected` возвращает отложенные события в очередь.

## Тесты

```bash
pip install pytest pytest-asyncio httpx
python -m pytest voice/tests -q
```

Тесты логики идут без SDK; `test_agent_sdk.py` пропускается, если `videosdk-agents` не установлен.
