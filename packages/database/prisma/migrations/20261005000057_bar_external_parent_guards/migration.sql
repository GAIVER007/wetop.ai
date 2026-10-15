-- Q-BAR-REVERSE-PARENTS, ADR-BAR-REVERSE-PARENTS, approved 2026-10-05.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'BAR ownership migration requires an administrative BYPASSRLS role for validation';
  END IF;
  IF EXISTS (
    SELECT 1 FROM bar_products p JOIN bar_categories c ON c.id=p.category_id WHERE p.property_id<>c.property_id
    UNION ALL
    SELECT 1 FROM bar_receipts r JOIN bar_suppliers s ON s.id=r.supplier_id WHERE r.property_id<>s.property_id
    UNION ALL
    SELECT 1 FROM bar_receipt_lines l JOIN bar_receipts r ON r.id=l.receipt_id JOIN bar_products p ON p.id=l.product_id WHERE r.property_id<>p.property_id
    UNION ALL
    SELECT 1 FROM bar_stock_lots l JOIN bar_products p ON p.id=l.product_id JOIN bar_receipt_lines rl ON rl.id=l.receipt_line_id JOIN bar_receipts r ON r.id=rl.receipt_id WHERE l.property_id<>p.property_id OR l.property_id<>r.property_id OR l.product_id<>rl.product_id
    UNION ALL
    SELECT 1 FROM bar_stock_movements m JOIN bar_products p ON p.id=m.product_id LEFT JOIN bar_stock_lots l ON l.id=m.lot_id WHERE m.property_id<>p.property_id OR (l.id IS NOT NULL AND (m.property_id<>l.property_id OR m.product_id<>l.product_id))
    UNION ALL
    SELECT 1 FROM bar_sale_lines l JOIN bar_sales s ON s.id=l.sale_id JOIN bar_products p ON p.id=l.product_id WHERE s.property_id<>p.property_id
    UNION ALL
    SELECT 1 FROM bar_supplier_payments p JOIN bar_receipts r ON r.id=p.receipt_id JOIN cash_operations c ON c.id=p.cash_operation_id WHERE r.property_id<>c.property_id
    UNION ALL
    SELECT 1 FROM bar_sales s JOIN folios f ON f.id=s.folio_id JOIN reservation_items i ON i.id=f.reservation_item_id JOIN reservations r ON r.id=i.reservation_id WHERE s.property_id<>r.property_id
    UNION ALL
    SELECT 1 FROM bar_sales s JOIN cash_operations c ON c.id=s.cash_operation_id WHERE s.property_id<>c.property_id
    UNION ALL
    SELECT 1 FROM bar_sales s JOIN charges c ON c.id=s.charge_id JOIN folios f ON f.id=c.folio_id JOIN reservation_items i ON i.id=f.reservation_item_id JOIN reservations r ON r.id=i.reservation_id WHERE s.property_id<>r.property_id OR (s.folio_id IS NOT NULL AND s.folio_id<>c.folio_id)
  ) THEN
    RAISE EXCEPTION 'Existing BAR ownership violations: reconciliation required before migration';
  END IF;
END $$;

CREATE FUNCTION bar_external_parent_guard() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  affected record;
  linked_property uuid;
  linked_item uuid;
  linked_reservation uuid;
BEGIN
  IF TG_OP <> 'UPDATE' OR TG_TABLE_NAME NOT IN ('cash_operations','charges','folios','reservation_items','reservations') THEN
    RAISE EXCEPTION 'Unsupported table/operation for bar_external_parent_guard';
  END IF;
  -- UPDATE already holds the parent row lock. BAR-side FOR SHARE checks conflict
  -- with it. Lock affected BAR rows too, and validate against the NEW parent chain.
  IF TG_TABLE_NAME = 'cash_operations' THEN
    IF NEW.property_id IS NOT DISTINCT FROM OLD.property_id THEN RETURN NEW; END IF;
    FOR affected IN SELECT r.property_id FROM bar_supplier_payments p JOIN bar_receipts r ON r.id=p.receipt_id
      WHERE p.cash_operation_id=OLD.id FOR SHARE OF p,r LOOP
      IF NEW.property_id IS DISTINCT FROM affected.property_id THEN
        RAISE EXCEPTION 'BAR payment cash reverse ownership mismatch';
      END IF;
    END LOOP;
    FOR affected IN SELECT s.property_id FROM bar_sales s WHERE s.cash_operation_id=OLD.id FOR SHARE LOOP
      IF NEW.property_id IS DISTINCT FROM affected.property_id THEN
        RAISE EXCEPTION 'BAR sale cash reverse ownership mismatch';
      END IF;
    END LOOP;
  ELSIF TG_TABLE_NAME = 'charges' THEN
    IF NEW.folio_id IS NOT DISTINCT FROM OLD.folio_id THEN RETURN NEW; END IF;
    FOR affected IN SELECT s.property_id,s.folio_id FROM bar_sales s WHERE s.charge_id=OLD.id FOR SHARE LOOP
      SELECT r.property_id,i.id,r.id INTO linked_property,linked_item,linked_reservation FROM folios f JOIN reservation_items i ON i.id=f.reservation_item_id JOIN reservations r ON r.id=i.reservation_id
        WHERE f.id=NEW.folio_id FOR SHARE OF f,i,r;
      IF linked_property IS NULL OR linked_property<>affected.property_id OR
         (affected.folio_id IS NOT NULL AND affected.folio_id<>NEW.folio_id) THEN
        RAISE EXCEPTION 'BAR charge reverse ownership mismatch';
      END IF;
      -- Version new ancestors as well as BAR link parents: stale ancestor snapshots
      -- must detect newly relocated BAR dependencies after a valid reparent.
      UPDATE folios SET reservation_item_id=reservation_item_id WHERE id=NEW.folio_id;
      UPDATE reservation_items SET reservation_id=reservation_id WHERE id=linked_item;
      UPDATE reservations SET property_id=property_id WHERE id=linked_reservation;
    END LOOP;
  ELSIF TG_TABLE_NAME = 'folios' THEN
    IF NEW.reservation_item_id IS NOT DISTINCT FROM OLD.reservation_item_id THEN RETURN NEW; END IF;
    FOR affected IN SELECT s.property_id FROM bar_sales s WHERE s.folio_id=OLD.id OR EXISTS
      (SELECT 1 FROM charges c WHERE c.id=s.charge_id AND c.folio_id=OLD.id) FOR SHARE OF s LOOP
      SELECT r.property_id,i.id,r.id INTO linked_property,linked_item,linked_reservation FROM reservation_items i JOIN reservations r ON r.id=i.reservation_id
        WHERE i.id=NEW.reservation_item_id FOR SHARE OF i,r;
      IF linked_property IS NULL OR linked_property<>affected.property_id THEN
        RAISE EXCEPTION 'BAR folio reverse ownership mismatch';
      END IF;
      UPDATE reservation_items SET reservation_id=reservation_id WHERE id=linked_item;
      UPDATE reservations SET property_id=property_id WHERE id=linked_reservation;
    END LOOP;
  ELSIF TG_TABLE_NAME = 'reservation_items' THEN
    IF NEW.reservation_id IS NOT DISTINCT FROM OLD.reservation_id THEN RETURN NEW; END IF;
    FOR affected IN SELECT s.property_id FROM bar_sales s WHERE EXISTS
      (SELECT 1 FROM folios f WHERE f.reservation_item_id=OLD.id AND
        (s.folio_id=f.id OR EXISTS (SELECT 1 FROM charges c WHERE c.id=s.charge_id AND c.folio_id=f.id))) FOR SHARE OF s LOOP
      SELECT r.property_id INTO linked_property FROM reservations r WHERE r.id=NEW.reservation_id FOR SHARE;
      IF linked_property IS NULL OR linked_property<>affected.property_id THEN
        RAISE EXCEPTION 'BAR reservation item reverse ownership mismatch';
      END IF;
      UPDATE reservations SET property_id=property_id WHERE id=NEW.reservation_id;
    END LOOP;
  ELSIF TG_TABLE_NAME = 'reservations' THEN
    IF NEW.property_id IS NOT DISTINCT FROM OLD.property_id THEN RETURN NEW; END IF;
    FOR affected IN SELECT s.property_id FROM bar_sales s WHERE EXISTS
      (SELECT 1 FROM reservation_items i JOIN folios f ON f.reservation_item_id=i.id
        WHERE i.reservation_id=OLD.id AND (s.folio_id=f.id OR EXISTS
          (SELECT 1 FROM charges c WHERE c.id=s.charge_id AND c.folio_id=f.id))) FOR SHARE OF s LOOP
      IF NEW.property_id IS DISTINCT FROM affected.property_id THEN
        RAISE EXCEPTION 'BAR reservation reverse ownership mismatch';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

-- A FOR SHARE lock alone does not change tuple versions. A parent transaction at
-- REPEATABLE READ could otherwise retain a snapshot preceding a committed BAR link.
-- Version only referenced parents, preserving their values, to force 40001 on stale writers.
CREATE FUNCTION bar_external_parent_version_fence() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  folio uuid;
  linked_item uuid;
  linked_reservation uuid;
BEGIN
  IF TG_OP NOT IN ('INSERT','UPDATE') OR TG_TABLE_NAME NOT IN ('bar_sales','bar_supplier_payments') THEN
    RAISE EXCEPTION 'Unsupported table/operation for bar_external_parent_version_fence';
  END IF;
  IF TG_TABLE_NAME = 'bar_supplier_payments' THEN
    IF TG_OP='UPDATE' AND NEW.cash_operation_id IS NOT DISTINCT FROM OLD.cash_operation_id THEN RETURN NEW; END IF;
    UPDATE cash_operations SET property_id=property_id WHERE id=NEW.cash_operation_id;
  ELSIF TG_TABLE_NAME = 'bar_sales' THEN
    IF TG_OP='UPDATE' AND NEW.cash_operation_id IS NOT DISTINCT FROM OLD.cash_operation_id
      AND NEW.folio_id IS NOT DISTINCT FROM OLD.folio_id AND NEW.charge_id IS NOT DISTINCT FROM OLD.charge_id THEN RETURN NEW; END IF;
    IF NEW.cash_operation_id IS NOT NULL THEN
      UPDATE cash_operations SET property_id=property_id WHERE id=NEW.cash_operation_id;
    END IF;
    IF NEW.charge_id IS NOT NULL THEN
      UPDATE charges SET folio_id=folio_id WHERE id=NEW.charge_id RETURNING folio_id INTO folio;
    END IF;
    FOR folio IN SELECT DISTINCT id FROM folios WHERE id=NEW.folio_id OR id=folio LOOP
      UPDATE folios SET reservation_item_id=reservation_item_id WHERE id=folio RETURNING reservation_item_id INTO linked_item;
      UPDATE reservation_items SET reservation_id=reservation_id WHERE id=linked_item RETURNING reservation_id INTO linked_reservation;
      UPDATE reservations SET property_id=property_id WHERE id=linked_reservation;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE
  s text := current_schema();
  path text;
BEGIN
  path := CASE WHEN s = 'public' THEN 'public, pg_temp' ELSE format('%I, public, pg_temp', s) END;
  EXECUTE format('ALTER FUNCTION %I.bar_external_parent_guard() SET search_path = %s', s, path);
  EXECUTE format('ALTER FUNCTION %I.bar_external_parent_version_fence() SET search_path = %s', s, path);
END $$;

CREATE TRIGGER cash_operations_bar_ownership BEFORE UPDATE OF property_id ON cash_operations FOR EACH ROW EXECUTE FUNCTION bar_external_parent_guard();
CREATE TRIGGER charges_bar_ownership BEFORE UPDATE OF folio_id ON charges FOR EACH ROW EXECUTE FUNCTION bar_external_parent_guard();
CREATE TRIGGER folios_bar_ownership BEFORE UPDATE OF reservation_item_id ON folios FOR EACH ROW EXECUTE FUNCTION bar_external_parent_guard();
CREATE TRIGGER reservation_items_bar_ownership BEFORE UPDATE OF reservation_id ON reservation_items FOR EACH ROW EXECUTE FUNCTION bar_external_parent_guard();
CREATE TRIGGER reservations_bar_ownership BEFORE UPDATE OF property_id ON reservations FOR EACH ROW EXECUTE FUNCTION bar_external_parent_guard();

CREATE TRIGGER bar_sales_external_parent_versions AFTER INSERT OR UPDATE OF cash_operation_id,folio_id,charge_id ON bar_sales FOR EACH ROW EXECUTE FUNCTION bar_external_parent_version_fence();
CREATE TRIGGER bar_supplier_payments_external_parent_versions AFTER INSERT OR UPDATE OF cash_operation_id ON bar_supplier_payments FOR EACH ROW EXECUTE FUNCTION bar_external_parent_version_fence();
