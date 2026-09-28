import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, createPropertyInChain, type Db } from '@pms/database';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;
class Rollback extends Error {}

/**
 * Platform P1, cleanup (DATA_MODEL v2.6, §18.4): после production backfill объект без филиала больше
 * не бывает. База сама не принимает `properties.location_id IS NULL`, а новый объект создаётся сразу
 * с цепочкой Organization → Business → Location одной функцией `createPropertyInChain`. На базе без
 * миграции 20260928000032 первый тест красный: вставка без location_id проходит.
 */
describe.skipIf(!url)('Platform P1: объект всегда в цепочке (integration, DATABASE_URL required)', () => {
  let db: Db;
  let client: pg.Client;
  beforeAll(async () => {
    db = createPrismaClient(url);
    // та же схема, что у Prisma-клиента (DATABASE_SCHEMA — pms_test у набора integration, ADR-042)
    const schema = process.env.DATABASE_SCHEMA?.trim() || 'public';
    client = new pg.Client({ connectionString: url, options: `-c search_path=${schema},public` });
    await client.connect();
  });
  afterAll(async () => {
    await client?.end();
    await db?.$disconnect();
  });

  it('база не принимает объект без филиала: properties.location_id NOT NULL', async () => {
    await client.query('BEGIN');
    try {
      const org = randomUUID();
      await client.query(`INSERT INTO organizations (id, name) VALUES ($1, 'Без филиала')`, [org]);
      await expect(
        client.query(
          `INSERT INTO properties (id, organization_id, name, timezone, currency, check_in_time, check_out_time, updated_at)
           VALUES ($1, $2, 'Объект без филиала', 'Asia/Almaty', 'KZT', '14:00', '12:00', now())`,
          [randomUUID(), org],
        ),
      ).rejects.toThrow(/location_id/);
    } finally {
      await client.query('ROLLBACK');
    }
  });

  it('createPropertyInChain: Business HOSPITALITY с именем организации, филиал — копия полей, второй объект — в тот же Business', async () => {
    let checked = false;
    await db
      .$transaction(async (tx) => {
        const org = await tx.organization.create({ data: { name: 'Хостел «Цепочка»' }, select: { id: true } });
        const first = await createPropertyInChain(tx, org.id, {
          name: 'Цепочка — центр',
          address: 'ул. Вымышленная, 1',
          phone: '+70000000000',
          email: 'center@example.invalid',
          timezone: 'Asia/Almaty',
          currency: 'KZT',
          checkInTime: '14:00',
          checkOutTime: '12:00',
        });
        const second = await createPropertyInChain(tx, org.id, {
          name: 'Цепочка — вокзал',
          timezone: 'Asia/Almaty',
          currency: 'KZT',
          checkInTime: '14:00',
          checkOutTime: '12:00',
        });
        const rows = await tx.property.findMany({
          where: { id: { in: [first.id, second.id] } },
          orderBy: { createdAt: 'asc' },
          select: {
            organizationId: true,
            location: {
              select: {
                name: true,
                address: true,
                phone: true,
                email: true,
                timezone: true,
                currency: true,
                business: { select: { id: true, organizationId: true, name: true, vertical: true } },
              },
            },
          },
        });
        expect(rows).toHaveLength(2);
        const [a, b] = rows;
        expect(a!.organizationId).toBe(org.id);
        expect(a!.location).toMatchObject({
          name: 'Цепочка — центр',
          address: 'ул. Вымышленная, 1',
          phone: '+70000000000',
          email: 'center@example.invalid',
          timezone: 'Asia/Almaty',
          currency: 'KZT',
          business: { organizationId: org.id, name: 'Хостел «Цепочка»', vertical: 'HOSPITALITY' },
        });
        expect(b!.location.name).toBe('Цепочка — вокзал');
        expect(b!.location.business.id, 'второй объект — тот же Business, новый не заводится').toBe(
          a!.location.business.id,
        );
        expect(await tx.business.count({ where: { organizationId: org.id } })).toBe(1);
        checked = true;
        throw new Rollback();
      })
      .catch((e: unknown) => {
        if (!(e instanceof Rollback)) throw e;
      });
    expect(checked).toBe(true);
  });

  it('у каждого объекта организация совпадает с организацией его Business (broken_chain = 0)', async () => {
    const res = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM properties p
         LEFT JOIN locations l ON l.id = p.location_id
         LEFT JOIN businesses b ON b.id = l.business_id
        WHERE p.location_id IS NULL OR b.id IS NULL OR b.organization_id IS DISTINCT FROM p.organization_id`,
    );
    expect(res.rows[0]!.n).toBe(0);
  });
});
