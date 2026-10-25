-- Дополнительная защита CASH-SHIFTS-20261025 на уровне базы.
CREATE FUNCTION cash_register_scope_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.property_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM properties p WHERE p.id=NEW.property_id AND p.organization_id=NEW.organization_id AND p.currency=NEW.currency)
 OR NEW.location_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM locations l JOIN businesses b ON b.id=l.business_id WHERE l.id=NEW.location_id AND b.organization_id=NEW.organization_id AND l.currency=NEW.currency)
 THEN RAISE EXCEPTION 'Касса принадлежит другой области или валюте'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(NEW.cashier_ids) u WHERE NOT EXISTS(SELECT 1 FROM memberships m WHERE m.user_id=u AND m.organization_id=NEW.organization_id AND m.status='ACTIVE'))
 THEN RAISE EXCEPTION 'Кассир не состоит в организации'; END IF;
 IF TG_OP='UPDATE' AND (NEW.id,NEW.organization_id,NEW.property_id,NEW.location_id,NEW.currency) IS DISTINCT FROM (OLD.id,OLD.organization_id,OLD.property_id,OLD.location_id,OLD.currency)
 THEN RAISE EXCEPTION 'Область действующей кассы не меняется'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cash_register_scope_guard BEFORE INSERT OR UPDATE ON cash_registers FOR EACH ROW EXECUTE FUNCTION cash_register_scope_guard();
CREATE FUNCTION cash_shift_integrity_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND (OLD.closed_at IS NOT NULL OR
  (NEW.id,NEW.register_id,NEW.responsible_user_id,NEW.opened_at,NEW.opening) IS DISTINCT FROM
  (OLD.id,OLD.register_id,OLD.responsible_user_id,OLD.opened_at,OLD.opening))
 THEN RAISE EXCEPTION 'Закрытый отчёт и начало смены не изменяются'; END IF;
 IF NEW.closed_by_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM cash_registers r JOIN memberships m ON m.organization_id=r.organization_id WHERE r.id=NEW.register_id AND m.user_id=NEW.closed_by_id AND m.status='ACTIVE') THEN RAISE EXCEPTION 'Закрывающий не состоит в организации кассы'; END IF;
 IF NOT EXISTS(SELECT 1 FROM cash_registers r JOIN memberships m ON m.organization_id=r.organization_id WHERE r.id=NEW.register_id AND m.user_id=NEW.responsible_user_id AND m.status='ACTIVE')
 THEN RAISE EXCEPTION 'Ответственный не состоит в организации кассы'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cash_shift_integrity_guard BEFORE INSERT OR UPDATE ON cash_shifts FOR EACH ROW EXECUTE FUNCTION cash_shift_integrity_guard();
CREATE FUNCTION cash_shift_operation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.cash_shift_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM cash_shifts s JOIN cash_registers r ON r.id=s.register_id
  WHERE s.id=NEW.cash_shift_id AND CASE WHEN TG_TABLE_NAME='cash_operations' THEN r.property_id::text=to_jsonb(NEW)->>'property_id' ELSE r.location_id::text=to_jsonb(NEW)->>'location_id' END
  AND (TG_OP='UPDATE' OR s.closed_at IS NULL))
 THEN RAISE EXCEPTION 'Операция относится к другой кассе или закрытой смене'; END IF;
 IF TG_OP='UPDATE' AND NEW.cash_shift_id IS DISTINCT FROM OLD.cash_shift_id THEN RAISE EXCEPTION 'Привязка операции к смене не меняется'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cash_shift_operation_guard BEFORE INSERT OR UPDATE ON cash_operations FOR EACH ROW EXECUTE FUNCTION cash_shift_operation_guard();
CREATE FUNCTION cash_handover_integrity_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM cash_registers r JOIN memberships m ON m.organization_id=r.organization_id WHERE r.id=NEW.register_id AND m.user_id=NEW.requested_by_id AND m.status='ACTIVE') THEN RAISE EXCEPTION 'Отправитель не состоит в организации кассы'; END IF;
 IF NOT EXISTS(SELECT 1 FROM cash_shifts s JOIN cash_registers r ON r.id=s.register_id JOIN memberships m ON m.organization_id=r.organization_id
  WHERE s.id=NEW.shift_id AND s.register_id=NEW.register_id AND s.closed_at IS NOT NULL AND m.user_id=NEW.recipient_id AND m.status='ACTIVE')
 THEN RAISE EXCEPTION 'Передача относится к другой кассе или недоступному получателю'; END IF;
 IF TG_OP='UPDATE' AND (OLD.acknowledged_at IS NOT NULL OR
  (NEW.id,NEW.register_id,NEW.shift_id,NEW.amount,NEW.recipient_id,NEW.requested_by_id,NEW.created_at) IS DISTINCT FROM
  (OLD.id,OLD.register_id,OLD.shift_id,OLD.amount,OLD.recipient_id,OLD.requested_by_id,OLD.created_at))
 THEN RAISE EXCEPTION 'Передача изменяется только однократным подтверждением'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cash_handover_integrity_guard BEFORE INSERT OR UPDATE ON cash_handovers FOR EACH ROW EXECUTE FUNCTION cash_handover_integrity_guard();

CREATE TRIGGER cash_shift_operation_guard BEFORE INSERT OR UPDATE ON restaurant_cash_operations FOR EACH ROW EXECUTE FUNCTION cash_shift_operation_guard();

REVOKE UPDATE ON cash_commands FROM wetop_app,wetop_service;
