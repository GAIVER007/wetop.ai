-- 180 NBK-FX-20261101: курсы Нацбанка РК по дням (владелец 01.11.2026: «вариант первый, только всё показывай в той
-- валюте, которая в системе»; «курс Нацбанка РК на каждый день, сам подтягивается, каждая сумма по курсу своего дня»;
-- DATA_MODEL NBK-FX-20261101, ADR-OWNER-FX-20261101).
-- Справочник без организации: официальный курс один на всех. Тенге за 1 единицу валюты в миллионных долях (6 знаков),
-- строка дня не меняется (повторная загрузка того же дня ничего не пишет). Аддитивно: новая таблица, старые не меняются.
-- Права: RLS нет (данных организаций нет), wetop_app только читает, wetop_service читает и добавляет, без UPDATE/DELETE.
CREATE TABLE IF NOT EXISTS exchange_rates (
  rate_date date NOT NULL,
  currency char(3) NOT NULL,
  kzt_per_unit_micro bigint NOT NULL,
  source varchar(10) NOT NULL DEFAULT 'NBK',
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (rate_date, currency),
  CONSTRAINT exchange_rates_values CHECK (kzt_per_unit_micro > 0 AND currency ~ '^[A-Z]{3}$' AND currency <> 'KZT' AND source IN ('NBK'))
);
CREATE INDEX IF NOT EXISTS exchange_rates_currency_date ON exchange_rates (currency, rate_date);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wetop_app') THEN
    EXECUTE 'REVOKE ALL ON TABLE exchange_rates FROM wetop_app';
    EXECUTE 'GRANT SELECT ON TABLE exchange_rates TO wetop_app';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wetop_service') THEN
    EXECUTE 'REVOKE ALL ON TABLE exchange_rates FROM wetop_service';
    EXECUTE 'GRANT SELECT, INSERT ON TABLE exchange_rates TO wetop_service';
  END IF;
END $$;
