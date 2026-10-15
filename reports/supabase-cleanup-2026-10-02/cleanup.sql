-- Чистка рабочей базы Supabase от проверочных данных и шума журналов.
-- Проект: bobbkvlnjppvqwrpzmvz (ap-southeast-1), Postgres 17.6.
-- Составлено 02.10.2026 по решению владельца (выбор: инциденты + сессии/токены + проверочные брони).
--
-- КАК ЗАПУСКАТЬ: Supabase Dashboard -> SQL Editor -> вставить целиком -> Run.
-- Скрипт идёт одной транзакцией: при любой ошибке не применяется ничего.
-- Перед запуском сделайте копию базы (на сервере: pg_dump в /root/backups).
--
-- ЧТО НЕ ТРОГАЕТСЯ СОЗНАТЕЛЬНО:
--   audit_logs            - журнал только дописывается (DATA_MODEL v1.7, триггер audit_logs_immutable)
--   user_errors           - все 71 записи внутри окна 30 суток (§14)
--   daily_rates           - 8 640 строк, контрольное число проекта
--   inventory_units       - фонд объекта
--   housekeeping_events   - состояние уборки мест
--   inventory_blocks      - блокировки мест
--   external_events       - 4 входящих события Channex
--   channel_outbox        - 6 исходящих задач каналов
--   схема pms_test        - рабочая схема интеграционных тестов (SECURITY.md)

begin;

-- Контрольные числа ДО
select 'ДО' as когда, 'incidents' as что, count(*) as строк from public.system_incidents
union all select 'ДО', 'sessions', count(*) from public.sessions
union all select 'ДО', 'reservations', count(*) from public.reservations
union all select 'ДО', 'guests', count(*) from public.guests;

-- Страховка: убедиться, что живых гостей нет. Если найдётся гость не со стендовым
-- именем, скрипт прервётся и ничего не применит.
do $$
declare живые int;
begin
  select count(*) into живые
  from public.guests
  where first_name not in ('Гость') or last_name !~ '^(Стойка|Канал)-';
  if живые > 0 then
    raise exception 'Найдено % гостей вне стендового шаблона. Чистка прервана, проверьте вручную.', живые;
  end if;
end $$;

-- 1. Шум сторожа: решённые инциденты (418 строк, из них 397 - web.down за 29.09-01.10).
--    Открытые и эскалированные остаются.
delete from public.system_incidents where status = 'RESOLVED';

-- 2. Мёртвые сессии и отработанные токены.
delete from public.sessions         where expires_at < now() or revoked_at is not null;
delete from public.password_resets  where expires_at < now() or used_at is not null;
delete from public.invites          where expires_at < now() or accepted_at is not null;

-- 3. Проверочные брони и стендовые гости. Порядок обязателен: все связи RESTRICT.
delete from public.refunds;
delete from public.payment_allocations;
delete from public.charges;
delete from public.folios;
delete from public.allocations;
delete from public.stay_guests;
delete from public.payments;
delete from public.reservation_items;
delete from public.reservations;
delete from public.guest_documents;
delete from public.guests;

-- 4. Тестовая категория и её место: расхождение фонда 89 против контрольных 88.
--    Категория «TEST ЮНГА INVENTORY20261001 EDIT» (код category-74665316-...),
--    место YUNGA-TEST-20261001, заведены 01.10.2026 при проверках стойки.
--    Проверено на 02.10.2026: ни одного проживания, ни цены, ни ограничения,
--    ни тарифа, ни сопоставления Channex; только 3 события уборки и 1 блокировка.
--    Настоящие 88 мест сходятся: 36 + 36 + 8 + 4 + 4.
--    Страховка: имя категории обязано содержать «TEST», иначе скрипт прервётся.
do $$
declare cat uuid; unit uuid; room uuid; nm text;
begin
  select id, name into cat, nm from public.accommodation_types
  where code = 'category-74665316-234f-4968-aeec-685bcefa71d4';

  if cat is null then
    raise notice 'Тестовой категории уже нет, шаг 4 пропущен.';
    return;
  end if;

  if nm not like '%TEST%' then
    raise exception 'Категория % не похожа на тестовую. Шаг 4 прерван.', nm;
  end if;

  select id, physical_room_id into unit, room
  from public.inventory_units where accommodation_type_id = cat;

  if unit is not null then
    delete from public.inventory_blocks     where inventory_unit_id = unit;
    delete from public.housekeeping_events  where inventory_unit_id = unit;
    delete from public.inventory_units      where id = unit;
  end if;

  if room is not null and not exists (
    select 1 from public.inventory_units where physical_room_id = room
  ) then
    delete from public.physical_rooms where id = room;
  end if;

  delete from public.accommodation_types where id = cat;
  raise notice 'Шаг 4: тестовая категория и её место удалены, фонд приведён к 88.';
end $$;

-- Контрольные числа ПОСЛЕ. Ожидается: incidents 1, sessions 2, остальное 0,
-- inventory_units 88, physical_rooms 88, accommodation_types 5.
select 'ПОСЛЕ' as когда, 'incidents' as что, count(*) as строк from public.system_incidents
union all select 'ПОСЛЕ', 'sessions', count(*) from public.sessions
union all select 'ПОСЛЕ', 'reservations', count(*) from public.reservations
union all select 'ПОСЛЕ', 'guests', count(*) from public.guests
union all select 'ПОСЛЕ', 'folios', count(*) from public.folios
union all select 'ПОСЛЕ', 'charges', count(*) from public.charges
union all select 'ПОСЛЕ', 'payments', count(*) from public.payments
union all select 'ПОСЛЕ', 'audit_logs (не тронут)', count(*) from public.audit_logs
union all select 'ПОСЛЕ', 'daily_rates (не тронут)', count(*) from public.daily_rates
union all select 'ПОСЛЕ', 'inventory_units (ждём 88)', count(*) from public.inventory_units
union all select 'ПОСЛЕ', 'physical_rooms (ждём 88)', count(*) from public.physical_rooms
union all select 'ПОСЛЕ', 'accommodation_types (ждём 5)', count(*) from public.accommodation_types;

commit;

-- После commit вернуть место операционной системе:
--   vacuum (analyze) public.system_incidents;
--   vacuum (analyze) public.reservations;
--   vacuum (analyze) public.guests;
