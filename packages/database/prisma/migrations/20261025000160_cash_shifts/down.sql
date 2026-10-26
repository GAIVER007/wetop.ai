DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM cash_shifts) OR EXISTS(SELECT 1 FROM cash_handovers) OR EXISTS(SELECT 1 FROM cash_commands)
 THEN RAISE EXCEPTION 'Касса уже содержит данные: нужен контролируемый откат по backup'; END IF;
END $$;
ALTER TABLE cash_operations DROP COLUMN cash_shift_id;
ALTER TABLE restaurant_cash_operations DROP COLUMN cash_shift_id;
DROP TABLE cash_commands,cash_handovers,cash_shifts,cash_registers;
DROP FUNCTION cash_scope_visible(uuid,uuid);
