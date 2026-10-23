-- Откат 145: только пока журналом голоса не пользовались. Звонки и просьбы ради отката не удаляют.
BEGIN;
LOCK TABLE "voice_callbacks", "voice_calls", "voice_profiles" IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "voice_callbacks") OR EXISTS (SELECT 1 FROM "voice_calls") OR EXISTS (SELECT 1 FROM "voice_profiles") THEN
    RAISE EXCEPTION 'Voice journal is in use: export it before rollback of 145';
  END IF;
END $$;

DROP TABLE "voice_callbacks";
DROP TABLE "voice_calls";
DROP TABLE "voice_profiles";
DROP FUNCTION voice_callback_guard();
DROP FUNCTION voice_call_state_guard();
DROP FUNCTION voice_scope_guard();
DROP TYPE "VoiceCallbackStatus";
DROP TYPE "VoiceCallState";
DROP TYPE "VoiceDirection";
COMMIT;
