import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;
class Rollback extends Error {}

/**
 * Миграция 150 «Загрузка конкурентов салона и ресторана» (DATA_MODEL §60): что держит сама база.
 * Всё в транзакции, которая откатывается: две организации, салон своей и ресторан чужой.
 */
describe.skipIf(!url)('location_competitors: принадлежность, RLS и права (integration, DATABASE_URL required)', () => {
  let client: pg.Client;
  beforeAll(async () => {
    const schema = process.env.DATABASE_SCHEMA?.trim() || 'public';
    client = new pg.Client({ connectionString: url, options: `-c search_path=${schema},public` });
    await client.connect();
  });
  afterAll(async () => {
    await client?.end();
  });

  async function inRollback(fn: () => Promise<void>): Promise<void> {
    await client.query('BEGIN');
    try {
      await fn();
      throw new Rollback();
    } catch (e) {
      await client.query('ROLLBACK');
      if (!(e instanceof Rollback)) throw e;
    }
  }
  /** Ошибка базы как текст, транзакция продолжается (точка сохранения) */
  async function fails(sql: string, params: unknown[]): Promise<string> {
    await client.query('SAVEPOINT try');
    try {
      await client.query(sql, params);
      return '';
    } catch (e) {
      return (e as Error).message;
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT try');
    }
  }
  async function asApp<T>(org: string, fn: () => Promise<T>): Promise<T> {
    await client.query('SAVEPOINT app');
    try {
      await client.query('SET LOCAL ROLE wetop_app');
      await client.query(`SELECT set_config('app.org_id', $1, true)`, [org]);
      return await fn();
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT app');
    }
  }

  async function seed() {
    const own = randomUUID(), other = randomUUID();
    const salon = randomUUID(), salonLoc = randomUUID(), hotel = randomUUID(), hotelLoc = randomUUID();
    const food = randomUUID(), foodLoc = randomUUID();
    await client.query(`INSERT INTO organizations (id, name) VALUES ($1, 'LC own'), ($2, 'LC other')`, [own, other]);
    await client.query(
      `INSERT INTO businesses(id,organization_id,name,vertical,updated_at) VALUES
        ($1,$2,'LC salon','BEAUTY',now()), ($3,$2,'LC hotel','HOSPITALITY',now()), ($4,$5,'LC food','FOOD_SERVICE',now())`,
      [salon, own, hotel, food, other],
    );
    await client.query(
      `INSERT INTO locations(id,business_id,name,timezone,currency,updated_at) VALUES
        ($1,$2,'LC salon','Asia/Almaty','KZT',now()), ($3,$4,'LC hotel','Asia/Almaty','KZT',now()), ($5,$6,'LC food','Asia/Almaty','KZT',now())`,
      [salonLoc, salon, hotelLoc, hotel, foodLoc, food],
    );
    return { own, other, salon, salonLoc, hotel, hotelLoc, food, foodLoc };
  }
  const insertCompetitor = `INSERT INTO location_competitors(id,organization_id,business_id,location_id,name,url,distance_m)
    VALUES ($1,$2,$3,$4,$5,$6,$7)`;

  it('сосед только своего филиала салона или ресторана; гостиница и чужая организация отказ', async () => {
    await inRollback(async () => {
      const s = await seed();
      await client.query(insertCompetitor, [randomUUID(), s.own, s.salon, s.salonLoc, 'Салон рядом', 'https://dikidi.net/ru/profile/x', 120]);
      expect(await fails(insertCompetitor, [randomUUID(), s.own, s.hotel, s.hotelLoc, 'Отель рядом', null, null])).toMatch(/another business or vertical/);
      // филиал чужого бизнеса под своим бизнесом
      expect(await fails(insertCompetitor, [randomUUID(), s.own, s.salon, s.foodLoc, 'Подмена', null, null])).toMatch(/another business or vertical/);
      // своя организация, чужой бизнес
      expect(await fails(insertCompetitor, [randomUUID(), s.own, s.food, s.foodLoc, 'Подмена', null, null])).toMatch(/another business or vertical/);
      // имя уникально в филиале без учёта регистра
      expect(await fails(insertCompetitor, [randomUUID(), s.own, s.salon, s.salonLoc, '  салон РЯДОМ ', null, null])).toMatch(/location_competitors_location_name_key/);
      expect(await fails(insertCompetitor, [randomUUID(), s.own, s.salon, s.salonLoc, 'Плохая ссылка', 'javascript:alert(1)', null])).toMatch(/location_competitors_values/);
      expect(await fails(insertCompetitor, [randomUUID(), s.own, s.salon, s.salonLoc, 'Минус', null, -1])).toMatch(/location_competitors_values/);
    });
  });

  it('снимок: сосед того же филиала, день не раньше даты наблюдения, «нет мест» без свободных окон, один на день', async () => {
    await inRollback(async () => {
      const s = await seed();
      const c = randomUUID();
      await client.query(insertCompetitor, [c, s.own, s.salon, s.salonLoc, 'Салон рядом', null, null]);
      const snap = `INSERT INTO location_competitor_snapshots(organization_id,location_id,competitor_id,day,observed_on,level,free_slots,source)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`;
      await client.query(snap, [s.own, s.salonLoc, c, '2026-10-30', '2026-10-23', 'FEW_LEFT', 3, 'AI_AGENT']);
      expect(await fails(snap, [s.own, s.salonLoc, c, '2026-10-30', '2026-10-23', 'AVAILABLE', 9, 'MANUAL'])).toMatch(/location_competitor_snapshots_day_key/);
      expect(await fails(snap, [s.own, s.salonLoc, c, '2026-10-22', '2026-10-23', 'AVAILABLE', null, 'MANUAL'])).toMatch(/snapshots_values/);
      expect(await fails(snap, [s.own, s.salonLoc, c, '2026-10-31', '2026-10-23', 'SOLD_OUT', 2, 'MANUAL'])).toMatch(/snapshots_values/);
      // сосед другого филиала: составной ключ
      expect(await fails(snap, [s.own, s.foodLoc, c, '2026-10-31', '2026-10-23', 'AVAILABLE', null, 'MANUAL'])).toMatch(/competitor_fkey/);
      // организация снимка должна совпасть с соседом
      expect(await fails(snap, [s.other, s.salonLoc, c, '2026-10-31', '2026-10-23', 'AVAILABLE', null, 'MANUAL'])).toMatch(/another organization/);
      // ключ снимка и владелец соседа не меняются
      expect(await fails(`UPDATE location_competitor_snapshots SET day='2026-11-01' WHERE competitor_id=$1`, [c])).toMatch(/key cannot change/);
      expect(await fails(`UPDATE location_competitors SET location_id=$2 WHERE id=$1`, [c, s.foodLoc])).toMatch(/owner cannot change/);
      // уровень и число поправить можно
      await client.query(`UPDATE location_competitor_snapshots SET level='SOLD_OUT', free_slots=0 WHERE competitor_id=$1`, [c]);
    });
  });

  it('RLS: роль приложения видит и пишет только свою организацию; соседа удалить нельзя, только в архив', async () => {
    await inRollback(async () => {
      const s = await seed();
      const own = randomUUID(), foreign = randomUUID();
      await client.query(insertCompetitor, [own, s.own, s.salon, s.salonLoc, 'Свой сосед', null, null]);
      await client.query(insertCompetitor, [foreign, s.other, s.food, s.foodLoc, 'Чужой сосед', null, null]);
      const seen = await asApp(s.own, async () =>
        (await client.query<{ id: string }>('SELECT id FROM location_competitors')).rows.map((r) => r.id),
      );
      expect(seen).toContain(own);
      expect(seen).not.toContain(foreign);
      expect(await asApp(s.own, async () => (await client.query('SELECT 1 FROM location_competitors WHERE id=$1', [foreign])).rowCount)).toBe(0);
      expect(await asApp('00000000-0000-0000-0000-000000000000', async () => (await client.query('SELECT 1 FROM location_competitors')).rowCount)).toBe(0);
      const writeForeign = await asApp(s.own, () => fails(insertCompetitor, [randomUUID(), s.other, s.food, s.foodLoc, 'Подлог', null, null]));
      // чужой филиал роли приложения не виден (RLS locations), триггер отказывает раньше политики вставки
      expect(writeForeign).toMatch(/row-level security|another business or vertical/);
      const del = await asApp(s.own, () => fails('DELETE FROM location_competitors WHERE id=$1', [own]));
      expect(del).toMatch(/permission denied/);
      await asApp(s.own, async () => {
        await client.query('UPDATE location_competitors SET active=false WHERE id=$1', [own]);
      });
      const force = await client.query<{ relname: string; f: boolean }>(
        `SELECT relname, relforcerowsecurity AS f FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = current_schema() AND relname IN ('location_competitors','location_competitor_snapshots') ORDER BY relname`,
      );
      expect(force.rows).toEqual([
        { relname: 'location_competitor_snapshots', f: true },
        { relname: 'location_competitors', f: true },
      ]);
    });
  });
});
