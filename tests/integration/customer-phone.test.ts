import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { customerPhoneKey } from '@pms/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env.DATABASE_URL;
const migrationPath = resolve(import.meta.dirname, '../../packages/database/prisma/migrations/20261018000131_customer_phone_normalized');

describe.skipIf(!url)('Customer: канонический телефон организации (M4-A)', () => {
  let client: pg.Client;
  const organizationId = randomUUID();
  const otherOrganizationId = randomUUID();

  beforeAll(async () => {
    client = new pg.Client({ connectionString: url });
    await client.connect();
    await client.query('SET search_path TO pms_test, public');
    for (const id of [organizationId, otherOrganizationId])
      await client.query('INSERT INTO organizations (id, name) VALUES ($1, $2)', [id, 'Синтетическая организация M4']);
  });
  afterAll(async () => {
    if (!client) return;
    await client.query('DELETE FROM customers WHERE organization_id = ANY($1::uuid[])', [[organizationId, otherOrganizationId]]);
    await client.query('DELETE FROM organizations WHERE id = ANY($1::uuid[])', [[organizationId, otherOrganizationId]]);
    await client.end();
  });

  async function insert(phone: string | null, org = organizationId) {
    const id = randomUUID();
    await client.query('INSERT INTO customers (id, organization_id, first_name, phone, updated_at) VALUES ($1,$2,$3,$4,now())',
      [id, org, 'Тестовый клиент M4', phone]);
    return id;
  }

  it('сырой и форматированный номер не создают двух клиентов организации', async () => {
    await insert('+77000002001');
    await expect(insert('8 (700) 000-20-01')).rejects.toThrow(/phone_normalized/);
  });

  it('сохраняет исходный номер и вычисляет ключ для старого писателя', async () => {
    const id = await insert('7000002002');
    const row = (await client.query('SELECT phone, phone_normalized FROM customers WHERE id=$1', [id])).rows[0];
    expect(row).toEqual({ phone: '7000002002', phone_normalized: '+77000002002' });
  });

  it('не позволяет подделать производный ключ и обновляет его при смене телефона', async () => {
    const id = await insert('+77000002003');
    await client.query('UPDATE customers SET phone=$1, phone_normalized=$2 WHERE id=$3', ['8 (700) 000-20-04', 'forged', id]);
    const row = (await client.query('SELECT phone_normalized FROM customers WHERE id=$1', [id])).rows[0];
    expect(row.phone_normalized).toBe('+77000002004');
  });

  it('одинаковый номер допустим в разных организациях', async () => {
    await insert('+77000002005');
    await expect(insert('87000002005', otherOrganizationId)).resolves.toEqual(expect.any(String));
  });

  it('несколько клиентов без телефона остаются допустимы', async () => {
    await insert(null);
    await expect(insert(null)).resolves.toEqual(expect.any(String));
  });

  it('SQL и TypeScript одинаково нормализуют поддерживаемые формы и ошибки', async () => {
    for (const phone of [null, '', '+77000002001', '87000002001', '7000002001', '8 (700) 000-20-01',
      '\t+7\u00a0700\u202f0002001\n', '+1 (202) 555-0101', '+1234567890', 'abc77000002001', '700+0002001', '123', '1'.repeat(16)]) {
      const result = await client.query('SELECT customer_phone_key($1) AS key', [phone]);
      expect(result.rows[0].key, String(phone)).toBe(customerPhoneKey(phone));
    }
  });

  it('два конкурентных старых писателя не обходят UNIQUE', async () => {
    const other = new pg.Client({ connectionString: url });
    await other.connect();
    try {
      await other.query('SET search_path TO pms_test, public');
      const results = await Promise.allSettled([
        insert('+77000002006'),
        other.query('INSERT INTO customers (id, organization_id, first_name, phone, updated_at) VALUES ($1,$2,$3,$4,now())',
          [randomUUID(), organizationId, 'Тестовый клиент гонки', '87000002006']),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    } finally { await other.end(); }
  });

  it('preflight read-only: только агрегаты без персональных данных', async () => {
    await client.query('BEGIN READ ONLY');
    try {
      const result = await client.query(readFileSync(resolve(migrationPath, 'preflight.sql'), 'utf8'));
      expect(Object.keys(result.rows[0]).sort()).toEqual(['customers', 'duplicate_groups', 'extra_duplicate_rows', 'supported_phones', 'unsupported_phones']);
      expect(result.rows[0].duplicate_groups).toBe('0');
    } finally { await client.query('ROLLBACK'); }
  });

  it('migration блокирует старые коллизии без merge, down сохраняет исходные данные', async () => {
    const schema = `phone_test_${randomUUID().replaceAll('-', '')}`;
    await client.query(`CREATE SCHEMA "${schema}"`);
    try {
      await client.query(`SET search_path TO "${schema}", public`);
      await client.query('CREATE TABLE customers (id uuid PRIMARY KEY, organization_id uuid NOT NULL, phone varchar(32))');
      const first = randomUUID(), second = randomUUID();
      await client.query('INSERT INTO customers VALUES ($1,$2,$3),($4,$2,$5)', [first, organizationId, '+77000003001', second, '87000003001']);
      const preview = await client.query(readFileSync(resolve(migrationPath, 'preflight.sql'), 'utf8'));
      expect(preview.rows[0]).toMatchObject({ duplicate_groups: '1', extra_duplicate_rows: '1' });
      const migration = readFileSync(resolve(migrationPath, 'migration.sql'), 'utf8');
      await expect(client.query(migration)).rejects.toThrow('duplicate groups');
      await client.query('ROLLBACK');
      const before = (await client.query('SELECT * FROM customers ORDER BY id')).rows;
      expect(before).toHaveLength(2);
      expect((await client.query('SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND column_name=$2', [schema, 'phone_normalized'])).rowCount).toBe(0);
      await client.query('UPDATE customers SET phone=$1 WHERE id=$2', ['87000003002', second]);
      const original = (await client.query('SELECT * FROM customers ORDER BY id')).rows;
      await client.query(migration);
      expect((await client.query('SELECT count(phone_normalized) FROM customers')).rows[0].count).toBe('2');
      await client.query(readFileSync(resolve(migrationPath, 'down.sql'), 'utf8'));
      expect((await client.query('SELECT * FROM customers ORDER BY id')).rows).toEqual(original);
    } finally {
      await client.query('ROLLBACK');
      await client.query('SET search_path TO pms_test, public');
      await client.query(`DROP SCHEMA "${schema}" CASCADE`);
    }
  });
});
