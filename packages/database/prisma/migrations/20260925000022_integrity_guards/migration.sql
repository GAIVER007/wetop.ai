-- ТЗ аудита 25.09.2026, блок 3 (С-4, С-14) — plans/security-audit-fixes-2026-09-25.md, DATA_MODEL v1.10.

-- С-4: дубль OTA-брони держал только check-then-act в коде; тот же столбец без индекса сканировался
-- на каждой ревизии Channex. NULL различны — ручные брони без внешнего номера не ограничиваются.
ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_property_id_external_id_key" UNIQUE ("property_id", "external_id");

-- С-14: деньги — только вперёд; ноль и минус суммы платежа, разнесения и возврата отвергает база,
-- а не проверка в коде (ADR-008: тиыны, сверка в ноль).
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_amount_positive" CHECK ("amount" > 0);

-- С-14: журнал действий только дописывается уже сейчас, не дожидаясь ролей базы в РК (DATA_MODEL §10 v1.7).
-- Обход — строго для уборки и восстановления тестовых данных: set_config('wetop.audit_purge','on',true)
-- в той же транзакции (cli-purge-test-data). Роль здесь одна, поэтому триггер, а не GRANT.
CREATE OR REPLACE FUNCTION audit_logs_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('wetop.audit_purge', true) = 'on' THEN
    RETURN COALESCE(OLD, NEW);
  END IF;
  -- Удаление сотрудника: FK users → audit_logs с ON DELETE SET NULL обнуляет только автора,
  -- сама запись журнала неприкосновенна. Пропускаем ровно это изменение и ничего больше.
  IF TG_OP = 'UPDATE' AND NEW.user_id IS NULL AND OLD.user_id IS NOT NULL
     AND to_jsonb(NEW) - 'user_id' = to_jsonb(OLD) - 'user_id' THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'audit_logs: журнал только дописывается (append-only), % запрещён; уборка тестовых данных ставит set_config(''wetop.audit_purge'',''on'',true) в своей транзакции', TG_OP
    USING ERRCODE = 'raise_exception';
END $$;

CREATE TRIGGER audit_logs_immutable
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable();
