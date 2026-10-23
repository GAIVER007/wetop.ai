# 153 voice_phone_limit

Хэш телефона для суточного лимита голосовых броней (Q-VOICE-10). Предложение и утверждение: DATA_MODEL.md,
`VOICE-PHONE-LIMIT-PROPOSAL-20261023` и `VOICE-PHONE-LIMIT-OWNER-APPROVAL-20261023`.

- Поле `guest_phone_hash` (CHAR(64), шестнадцатеричный HMAC-SHA256 номера E.164 с секретом `VOICE_PHONE_HASH_KEY`) в `seller_booking_intents` и `voice_booking_quotes`.
- Только у подтверждённой строки (CHECK). Частичный индекс (агент, хэш, `updated_at`).
- Лимит: скользящие 24 часа на агента, значение `voice_profiles.booking_max_per_phone_day` (по умолчанию 5). Обнуление хэша через 7 дней фоновой задачей API.
- Без секрета `VOICE_PHONE_HASH_KEY` лимит не работает, хэши не пишутся, API пишет предупреждение при запуске.

Порядок: backup, `scripts/ops/check-voice-schema.sh`, секрет `openssl rand -hex 32` в `.env` API (значение вписывает владелец), откат `down.sql`. Применяет владелец.
