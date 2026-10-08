import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient } from '../../packages/database/src/index';
import {
  connectionPool,
  utcConnectionString,
} from '../../packages/database/src/connection-timezone';

const adminUrl = process.env.A29_SCHEMA_ADMIN_URL;
const serviceUrl = process.env.A29_SCHEMA_SERVICE_URL;
const tenantUrl = process.env.A29_SCHEMA_TENANT_URL;
const enabled = Boolean(adminUrl && serviceUrl && tenantUrl);

const firstSchema = 'a29_connection_first';
const secondSchema = 'a29_connection_second';
const restrictedSchema = 'a29_connection_restricted';
const table = 'a29_connection_probe';
const roles = ['a29_service', 'a29_tenant'];

type Context = {
  schema: string;
  role: string;
  zone: string;
  pid: number;
  application: string;
  statementTimeout: string;
};

const contextSql = `
  SELECT current_schema() AS schema,
         current_user AS role,
         current_setting('TimeZone') AS zone,
         pg_backend_pid() AS pid,
         current_setting('application_name') AS application,
         current_setting('statement_timeout') AS "statementTimeout"`;

const urlWithOptions = (url: string, options: string) => {
  const parsed = new URL(url);
  parsed.searchParams.set('options', options);
  return parsed.toString();
};

describe.skipIf(!enabled)('A29 connection schema startup options', () => {
  const admin = new pg.Client({ connectionString: adminUrl });

  beforeAll(async () => {
    await admin.connect();
    for (const schema of [firstSchema, secondSchema, restrictedSchema]) {
      await admin.query(`DROP SCHEMA IF EXISTS ${pg.escapeIdentifier(schema)} CASCADE`);
      await admin.query(`CREATE SCHEMA ${pg.escapeIdentifier(schema)}`);
      await admin.query(
        `CREATE TABLE ${pg.escapeIdentifier(schema)}.${pg.escapeIdentifier(table)} (id text PRIMARY KEY, marker text NOT NULL)`,
      );
      await admin.query(
        `INSERT INTO ${pg.escapeIdentifier(schema)}.${pg.escapeIdentifier(table)} (id, marker) VALUES ('seed', $1)`,
        [schema],
      );
    }
    await admin.query(`DROP TABLE IF EXISTS public.${pg.escapeIdentifier(table)}`);
    await admin.query(
      `CREATE TABLE public.${pg.escapeIdentifier(table)} (id text PRIMARY KEY, marker text NOT NULL)`,
    );
    await admin.query(
      `INSERT INTO public.${pg.escapeIdentifier(table)} (id, marker) VALUES ('seed', 'public')`,
    );
    for (const role of roles) {
      await admin.query(
        `GRANT USAGE ON SCHEMA ${pg.escapeIdentifier(firstSchema)}, ${pg.escapeIdentifier(secondSchema)} TO ${pg.escapeIdentifier(role)}`,
      );
      await admin.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${pg.escapeIdentifier(firstSchema)}, ${pg.escapeIdentifier(secondSchema)} TO ${pg.escapeIdentifier(role)}`,
      );
      await admin.query(`GRANT USAGE ON SCHEMA public TO ${pg.escapeIdentifier(role)}`);
      await admin.query(
        `GRANT SELECT, INSERT ON public.${pg.escapeIdentifier(table)} TO ${pg.escapeIdentifier(role)}`,
      );
    }
  });

  afterAll(async () => {
    for (const schema of [firstSchema, secondSchema, restrictedSchema])
      await admin.query(`DROP SCHEMA IF EXISTS ${pg.escapeIdentifier(schema)} CASCADE`);
    await admin.query(`DROP TABLE IF EXISTS public.${pg.escapeIdentifier(table)}`);
    await admin.end();
  });

  it('preserves schema and URL options on the physical pg connection, with URL priority over PGOPTIONS', async () => {
    const pool = new pg.Pool({
      connectionString: utcConnectionString(
        urlWithOptions(serviceUrl!, '-c application_name=a29-url'),
        `-c search_path=${firstSchema},public`,
        '-c statement_timeout=4321',
      ),
      max: 1,
    });
    try {
      const first = (await pool.query<Context>(contextSql)).rows[0]!;
      expect(first).toMatchObject({
        schema: firstSchema,
        role: 'a29_service',
        zone: 'UTC',
        application: 'a29-url',
        statementTimeout: '0',
      });
      expect(
        (await pool.query<{ marker: string }>(`SELECT marker FROM ${table} WHERE id='seed'`))
          .rows[0]?.marker,
      ).toBe(firstSchema);
      await pool.query(`INSERT INTO ${table} (id, marker) VALUES ('direct-write', 'direct')`);
      const reused = (await pool.query<Context>(contextSql)).rows[0]!;
      expect(reused.pid).toBe(first.pid);
      expect(reused.schema).toBe(firstSchema);
      expect(reused.zone).toBe('UTC');
    } finally {
      await pool.end();
    }
  });

  it('preflights callback connect and query paths before returning a physical connection', async () => {
    const pool = connectionPool(
      {
        connectionString: utcConnectionString(
          serviceUrl!,
          `-c search_path=${firstSchema},public`,
          '',
        ),
        max: 1,
      },
      firstSchema,
    );
    try {
      const connected = await new Promise<Context>((resolve, reject) => {
        pool.connect((connectError, client, done) => {
          if (connectError || !client) {
            reject(connectError ?? new Error('A29 callback connect returned no client'));
            return;
          }
          client.query<Context>(contextSql, (queryError, result) => {
            done(queryError);
            if (queryError) reject(queryError);
            else resolve(result.rows[0]!);
          });
        });
      });
      expect(connected).toMatchObject({
        schema: firstSchema,
        role: 'a29_service',
        zone: 'UTC',
      });

      const queried = await new Promise<Context>((resolve, reject) => {
        pool.query<Context>(contextSql, (error, result) => {
          if (error) reject(error);
          else resolve(result.rows[0]!);
        });
      });
      expect(queried).toMatchObject({
        schema: firstSchema,
        role: 'a29_service',
        zone: 'UTC',
      });
    } finally {
      await pool.end();
    }
  });

  it('accepts PostgreSQL supported compact and long search_path startup forms', async () => {
    for (const startupOptions of [
      `-csearch_path=${firstSchema},public`,
      `--search-path=${firstSchema},public`,
    ]) {
      const pool = new pg.Pool({
        connectionString: utcConnectionString(
          urlWithOptions(serviceUrl!, startupOptions),
          `-c search_path=${firstSchema},public`,
          '',
        ),
        max: 1,
      });
      try {
        expect((await pool.query<Context>(contextSql)).rows[0]).toMatchObject({
          schema: firstSchema,
          role: 'a29_service',
          zone: 'UTC',
        });
      } finally {
        await pool.end();
      }
    }
  });

  it('keeps schema, PGOPTIONS and UTC on the service factory path', async () => {
    const previousOptions = process.env.PGOPTIONS;
    process.env.PGOPTIONS = '-c statement_timeout=4321';
    const db = createPrismaClient(serviceUrl!, secondSchema);
    try {
      const first = (await db.$queryRawUnsafe<Context[]>(contextSql))[0]!;
      expect(first).toMatchObject({
        schema: secondSchema,
        role: 'a29_service',
        zone: 'UTC',
        statementTimeout: '4321ms',
      });
      expect(
        (
          await db.$queryRawUnsafe<Array<{ marker: string }>>(
            `SELECT marker FROM ${table} WHERE id='seed'`,
          )
        )[0]?.marker,
      ).toBe(secondSchema);
      await db.$executeRawUnsafe(
        `INSERT INTO ${table} (id, marker) VALUES ('service-write', 'service')`,
      );
      expect((await db.$queryRawUnsafe<Context[]>(contextSql))[0]!.schema).toBe(secondSchema);
    } finally {
      await db.$disconnect();
      if (previousOptions === undefined) delete process.env.PGOPTIONS;
      else process.env.PGOPTIONS = previousOptions;
    }
  });

  it('keeps schema and UTC across service and tenant pools, concurrent connections, commit and rollback', async () => {
    const previousMax = process.env.DATABASE_APP_POOL_MAX;
    process.env.DATABASE_APP_POOL_MAX = '2';
    let tenantId: string | null = null;
    const db = createPrismaClient(serviceUrl!, firstSchema, {
      of: () => tenantId,
      appConnectionString: urlWithOptions(tenantUrl!, '-c application_name=a29-tenant'),
    });
    try {
      expect((await db.$queryRawUnsafe<Context[]>(contextSql))[0]).toMatchObject({
        schema: firstSchema,
        role: 'a29_service',
        zone: 'UTC',
      });

      tenantId = '00000000-0000-0000-0000-000000000029';
      const connections = await Promise.all(
        ['one', 'two'].map((id) =>
          db.$transaction(async (tx) => {
            const row = (await tx.$queryRawUnsafe<Context[]>(contextSql))[0]!;
            await tx.$executeRawUnsafe('SELECT pg_sleep(0.1)');
            await tx.$executeRawUnsafe(
              `INSERT INTO ${table} (id, marker) VALUES ('tenant-${id}', 'tenant')`,
            );
            return row;
          }),
        ),
      );
      expect(new Set(connections.map((row) => row.pid)).size).toBe(2);
      for (const row of connections)
        expect(row).toMatchObject({
          schema: firstSchema,
          role: 'a29_tenant',
          zone: 'UTC',
          application: 'a29-tenant',
        });

      await db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `INSERT INTO ${table} (id, marker) VALUES ('committed', 'tenant')`,
        );
        await tx.$executeRawUnsafe(`SET LOCAL search_path=${secondSchema},public`);
        await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'Asia/Dubai'");
      });
      await expect(
        db.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(
            `INSERT INTO ${table} (id, marker) VALUES ('rolled-back', 'tenant')`,
          );
          await tx.$executeRawUnsafe(`SET LOCAL search_path=${secondSchema},public`);
          throw new Error('A29 intentional rollback');
        }),
      ).rejects.toThrow('A29 intentional rollback');

      const after = (await db.$queryRawUnsafe<Context[]>(contextSql))[0]!;
      expect(after).toMatchObject({ schema: firstSchema, role: 'a29_tenant', zone: 'UTC' });
      expect(
        await db.$queryRawUnsafe<Array<{ id: string }>>(
          `SELECT id FROM ${table} WHERE id IN ('committed', 'rolled-back') ORDER BY id`,
        ),
      ).toEqual([{ id: 'committed' }]);
    } finally {
      await db.$disconnect();
      if (previousMax === undefined) delete process.env.DATABASE_APP_POOL_MAX;
      else process.env.DATABASE_APP_POOL_MAX = previousMax;
    }
  });

  it('rejects a selected schema without USAGE instead of falling back to public', async () => {
    const db = createPrismaClient(serviceUrl!, restrictedSchema);
    try {
      await expect(
        db.$queryRawUnsafe<Array<{ marker: string }>>(
          `SELECT marker FROM ${table} WHERE id='seed'`,
        ),
      ).rejects.toThrow(
        `Database schema "${restrictedSchema}" is unavailable to the connection role`,
      );
      expect(
        Number(
          (
            await admin.query<{ count: string }>(
              `SELECT count(*) FROM public.${pg.escapeIdentifier(table)} WHERE marker <> 'public'`,
            )
          ).rows[0]!.count,
        ),
      ).toBe(0);
    } finally {
      await db.$disconnect();
    }
  });
});
