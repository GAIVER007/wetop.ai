# 146 voice_booking

Голосовая бронь, гостиница. Предложение и утверждение: DATA_MODEL.md, `VOICE-BOOKING-PROPOSAL-20261023` и `VOICE-BOOKING-OWNER-APPROVAL-20261023`.

- Значение `VOICE` в `ReservationSource`, `RestaurantReservationSource`, `AppointmentSource` (ADD VALUE, только добавление).
- Поля `voice_profiles`: `booking_enabled` (false), `booking_needs_approval` (true), `booking_max_per_call` (3), `booking_max_per_phone_day` (5).
- Канал `voice` у `seller_booking_intents`.
- Таблица `voice_booking_quotes` сюда не входит: она идёт со срезами ресторана и салона.
- Права: поля пишет служебная роль (как остальной `voice_profiles`). Право приложения на правку выключателя из стойки выдаст срез 4.

Порядок: перед применением backup; проверка `scripts/ops/check-voice-schema.sh`; откат `down.sql` (значения enum остаются).
Применяет владелец на сервере, `wetop-auto-deploy --migrations-applied` после.
