/**
 * Подготовка runtime-аудита на своей локальной PostgreSQL (scripts/ops/local-db.sh, порт AUDIT_PG_PORT):
 * роли и данные для A2, A23, A26 и A29. Запускается от суперпользователя локального стенда только здесь;
 * сами тесты и дочерний API ходят штатными ролями wetop_service и wetop_app (AUTH_REQUIRED=1).
 *
 * Вымышленные данные (ADR-010). Пароль A26 случайный и пишется только в каталог работы (A28_WORK_DIR, 0600).
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { hashPassword } from '../../packages/domain/src/accounts/password';

const port = Number(process.env.AUDIT_PG_PORT || '55601');
const database = process.env.A28_PG_DATABASE || 'pmslocal';
const workDir = process.env.A28_WORK_DIR;
if (!workDir) throw new Error('A28_WORK_DIR не задан');

const admin = new pg.Client({ host: '127.0.0.1', port, user: 'postgres', database });

async function main() {
  await admin.connect();
  const q = (sql: string, params: unknown[] = []) => admin.query(sql, params);
  const version = (await q("SELECT current_setting('server_version') AS v")).rows[0].v as string;
  if (!version.startsWith('16.')) throw new Error(`нужна PostgreSQL 16, на стенде ${version}`);

  // Подготовка и независимая SQL-сверка (как a28_migrator в A28): без суперпользователя, с обходом RLS
  await q(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'a24_migrator') THEN
      CREATE ROLE a24_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'a29_service') THEN CREATE ROLE a29_service LOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'a29_tenant') THEN CREATE ROLE a29_tenant LOGIN; END IF;
  END $$`);
  await q('GRANT USAGE, CREATE ON SCHEMA pms_test TO a24_migrator');
  await q('GRANT ALL ON ALL TABLES IN SCHEMA pms_test TO a24_migrator');
  await q('GRANT ALL ON ALL SEQUENCES IN SCHEMA pms_test TO a24_migrator');
  await q('GRANT pg_read_all_settings TO a24_migrator');
  // В A28 роль подготовки сама применяла миграции и владела таблицами: M11 из A23 ставит и снимает ограничение
  // на bar_sales. Штатные роли таблицами по-прежнему не владеют, их RLS не меняется
  await q(`DO $$ DECLARE t record; BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'pms_test' LOOP
      EXECUTE format('ALTER TABLE pms_test.%I OWNER TO a24_migrator', t.tablename);
    END LOOP;
  END $$`);
  await q(`GRANT CONNECT ON DATABASE "${database}" TO a24_migrator, a29_service, a29_tenant`);
  // A26 меняет пояс базы по умолчанию (ALTER DATABASE … SET timezone): нужен владелец базы
  await q(`ALTER DATABASE "${database}" OWNER TO a24_migrator`);
  // Штатные роли: миграции заводят их NOLOGIN, вход на loopback-стенде с trust
  await q('ALTER ROLE wetop_service LOGIN');
  await q('ALTER ROLE wetop_app LOGIN');
  const roles = (
    await q(
      "SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname IN ('wetop_service','wetop_app') ORDER BY rolname",
    )
  ).rows;
  if (JSON.stringify(roles) !== JSON.stringify([
    { rolname: 'wetop_app', rolsuper: false, rolbypassrls: false },
    { rolname: 'wetop_service', rolsuper: false, rolbypassrls: true },
  ]))
    throw new Error(`штатные роли не те: ${JSON.stringify(roles)}`);

  // A26: своя организация с владельцем, паролем и проведённым приходом бара
  const ids = Object.fromEntries(
    ['org', 'business', 'location', 'property', 'user', 'supplier', 'receipt'].map((k) => [k, randomUUID()]),
  );
  const email = `a26-${ids.user}@example.invalid`;
  const password = randomBytes(18).toString('base64url');
  const now = new Date().toISOString();
  await q('BEGIN');
  try {
    await q('SET LOCAL search_path TO pms_test, public');
    const insert = (table: string, row: Record<string, unknown>) => {
      const keys = Object.keys(row);
      return q(
        `INSERT INTO "${table}" (${keys.map((k) => `"${k}"`).join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')})`,
        Object.values(row),
      );
    };
    await insert('organizations', { id: ids.org, name: 'A26 synthetic organization', status: 'ACTIVE' });
    await insert('businesses', { id: ids.business, organization_id: ids.org, name: 'A26 synthetic hospitality', vertical: 'HOSPITALITY', updated_at: now });
    await insert('locations', { id: ids.location, business_id: ids.business, name: 'A26 synthetic location', timezone: 'Asia/Almaty', currency: 'KZT', updated_at: now });
    await insert('properties', { id: ids.property, organization_id: ids.org, location_id: ids.location, name: 'A26 synthetic property', timezone: 'Asia/Almaty', currency: 'KZT', check_in_time: '14:00', check_out_time: '12:00', updated_at: now });
    await insert('users', { id: ids.user, email, name: 'A26 synthetic owner', email_verified_at: now, password_hash: hashPassword(password) });
    await insert('memberships', { user_id: ids.user, organization_id: ids.org, role: 'OWNER' });
    // сессия организации для auth-date-consumers-a26 (сверка issued_at): токен тут же выбрасывается
    await insert('sessions', { id: randomUUID(), token_hash: randomBytes(32).toString('hex'), user_id: ids.user, organization_id: ids.org, expires_at: new Date(Date.now() + 3_600_000).toISOString() });
    await insert('bar_suppliers', { id: ids.supplier, property_id: ids.property, name: 'A26 synthetic supplier', updated_at: now });
    await insert('bar_receipts', { id: ids.receipt, property_id: ids.property, supplier_id: ids.supplier, document_number: 'A26-SYNTHETIC', document_date: '2026-10-07', received_date: '2026-10-07', status: 'POSTED', posted_at: now, currency: 'KZT', total_amount: '100', updated_at: now });
    await q('COMMIT');
  } catch (error) {
    await q('ROLLBACK');
    throw error;
  }
  mkdirSync(workDir!, { recursive: true, mode: 0o700 });
  writeFileSync(
    join(workDir!, 'a26-private.json'),
    JSON.stringify({ email, password, org: ids.org, user: ids.user }),
    { mode: 0o600 },
  );
  await prepareA25(q);
  await admin.end();
  console.log(JSON.stringify({ version, roles, a26Org: ids.org }));
}

/** A25 (браузер Бар-2): одна организация, бизнес гостиницы и два объекта, в KZT и в USD; спек сам добавляет новые */
async function prepareA25(q: (sql: string, params?: unknown[]) => Promise<pg.QueryResult>) {
  const org = randomUUID(), business = randomUUID(), user = randomUUID();
  const email = `a25-${user}@example.invalid`;
  const password = randomBytes(18).toString('base64url');
  const now = new Date().toISOString();
  const scopes: Record<string, { business: string; location: string; property: string; name: string }> = {};
  await q('BEGIN');
  try {
    await q('SET LOCAL search_path TO pms_test, public');
    await q("INSERT INTO organizations(id,name,status) VALUES($1,'A25 synthetic organization','ACTIVE')", [org]);
    await q("INSERT INTO businesses(id,organization_id,name,vertical,updated_at) VALUES($1,$2,'A25 synthetic hospitality','HOSPITALITY',$3)", [business, org, now]);
    for (const currency of ['KZT', 'USD']) {
      const location = randomUUID(), property = randomUUID(), name = `A25 ${currency} base`;
      await q("INSERT INTO locations(id,business_id,name,timezone,currency,updated_at) VALUES($1,$2,$3,'Asia/Almaty',$4,$5)", [location, business, name, currency, now]);
      await q("INSERT INTO properties(id,organization_id,location_id,name,timezone,currency,check_in_time,check_out_time,updated_at) VALUES($1,$2,$3,$4,'Asia/Almaty',$5,'14:00','12:00',$6)", [property, org, location, name, currency, now]);
      // одна единица продажи: без номеров гейт онбординга увёл бы рабочие экраны на настройку (как newScope в A25)
      const building = randomUUID(), floor = randomUUID(), room = randomUUID(), type = randomUUID();
      await q("INSERT INTO buildings(id,property_id,name) VALUES($1,$2,'A25 building')", [building, property]);
      await q("INSERT INTO floors(id,building_id,name) VALUES($1,$2,'1')", [floor, building]);
      await q("INSERT INTO physical_rooms(id,floor_id,room_number,capacity,updated_at) VALUES($1,$2,'1',1,$3)", [room, floor, now]);
      await q("INSERT INTO accommodation_types(id,property_id,code,name,kind,capacity_adults,updated_at) VALUES($1,$2,'A25','A25 room','PRIVATE_ROOM',1,$3)", [type, property, now]);
      await q("INSERT INTO inventory_units(id,property_id,physical_room_id,accommodation_type_id,kind,code,updated_at) VALUES($1,$2,$3,$4,'ROOM','A25',$5)", [randomUUID(), property, room, type, now]);
      scopes[currency] = { business, location, property, name };
    }
    await q('INSERT INTO users(id,email,name,email_verified_at,password_hash) VALUES($1,$2,$3,$4,$5)', [user, email, 'A25 synthetic owner', now, hashPassword(password)]);
    await q("INSERT INTO memberships(user_id,organization_id,role) VALUES($1,$2,'OWNER')", [user, org]);
    await q('COMMIT');
  } catch (error) {
    await q('ROLLBACK');
    throw error;
  }
  mkdirSync(join(workDir!, 'evidence'), { recursive: true, mode: 0o700 });
  writeFileSync(join(workDir!, 'a25-private.json'), JSON.stringify({ email, password, org, user, scopes }), { mode: 0o600 });
}

main().catch(async (error) => {
  console.error(`runtime-audit prepare: ${error instanceof Error ? error.message : String(error)}`);
  await admin.end().catch(() => undefined);
  process.exit(1);
});
