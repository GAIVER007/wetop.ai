import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isLocalDatabase } from '../tools/seed-local';

const url = process.env.DATABASE_URL;
const schema = () => process.env.DATABASE_SCHEMA || 'public';
const tables = ['beauty_positions', 'beauty_position_permissions', 'beauty_position_assignments'] as const;

/** BEAUTY-ACCESS-20261018 + REVOCATION: storage, tenant isolation and irreversible strict-mode history. */
describe.skipIf(!url)('Beauty positions: storage boundaries and revoked assignments', () => {
  let db: pg.Client;

  beforeAll(async () => {
    if (!isLocalDatabase(url!)) throw new Error('Beauty position integration test requires an isolated localhost PostgreSQL');
    db = new pg.Client({ connectionString: url, options: `-c search_path=${schema()},public` });
    await db.connect();
  });

  afterAll(async () => {
    await db?.end();
  });

  async function rollback(fn: () => Promise<void>) {
    await db.query('BEGIN');
    try {
      await fn();
    } finally {
      await db.query('ROLLBACK');
    }
  }

  async function savepoint(fn: () => Promise<void>) {
    await db.query('SAVEPOINT beauty_position_probe');
    try {
      await fn();
    } finally {
      await db.query('ROLLBACK TO SAVEPOINT beauty_position_probe');
    }
  }

  async function seed() {
    const ids = {
      org: randomUUID(),
      otherOrg: randomUUID(),
      user: randomUUID(),
      owner: randomUUID(),
      foreignUser: randomUUID(),
      business: randomUUID(),
      otherBusiness: randomUUID(),
      hospitality: randomUUID(),
      foreignBusiness: randomUUID(),
      location: randomUUID(),
      otherLocation: randomUUID(),
      foreignLocation: randomUUID(),
      position: randomUUID(),
      assignment: randomUUID(),
    };
    await db.query(`INSERT INTO organizations(id,name) VALUES($1,'Beauty access synthetic'),($2,'Beauty access foreign')`, [
      ids.org,
      ids.otherOrg,
    ]);
    await db.query(
      `INSERT INTO users(id,email,email_verified_at) VALUES
        ($1,$2,now()),($3,$4,now()),($5,$6,now())`,
      [
        ids.user,
        `beauty-position-${ids.user}@example.test`,
        ids.owner,
        `beauty-owner-${ids.owner}@example.test`,
        ids.foreignUser,
        `beauty-foreign-${ids.foreignUser}@example.test`,
      ],
    );
    await db.query(
      `INSERT INTO memberships(user_id,organization_id,role) VALUES($1,$2,'STAFF'),($3,$2,'OWNER'),($4,$5,'STAFF')`,
      [ids.user, ids.org, ids.owner, ids.foreignUser, ids.otherOrg],
    );
    await db.query(
      `INSERT INTO businesses(id,organization_id,name,vertical,updated_at) VALUES
        ($1,$2,'Beauty access','BEAUTY',now()),
        ($3,$2,'Beauty access other','BEAUTY',now()),
        ($4,$2,'Beauty access hotel','HOSPITALITY',now()),
        ($5,$6,'Beauty access foreign','BEAUTY',now())`,
      [ids.business, ids.org, ids.otherBusiness, ids.hospitality, ids.foreignBusiness, ids.otherOrg],
    );
    await db.query(
      `INSERT INTO locations(id,business_id,name,timezone,currency,updated_at) VALUES
        ($1,$2,'Beauty access location','Asia/Almaty','KZT',now()),
        ($3,$4,'Beauty access other location','Asia/Almaty','KZT',now()),
        ($5,$6,'Beauty access foreign location','Asia/Almaty','KZT',now())`,
      [ids.location, ids.business, ids.otherLocation, ids.otherBusiness, ids.foreignLocation, ids.foreignBusiness],
    );
    return ids;
  }

  async function insertPosition(ids: Awaited<ReturnType<typeof seed>>, name = 'Мастер') {
    await db.query(
      `INSERT INTO beauty_positions(id,business_id,name,revision,updated_at) VALUES($1,$2,$3,1,now())`,
      [ids.position, ids.business, name],
    );
  }

  async function insertAssignment(ids: Awaited<ReturnType<typeof seed>>, locationId: string | null = ids.location) {
    await db.query(
      `INSERT INTO beauty_position_assignments
        (id,user_id,organization_id,business_id,position_id,location_id,revision,updated_at)
       VALUES($1,$2,$3,$4,$5,$6,1,now())`,
      [ids.assignment, ids.user, ids.org, ids.business, ids.position, locationId],
    );
  }

  it('создаёт три таблицы утверждённой модели без автоматических назначений старым членствам', async () =>
    rollback(async () => {
      for (const table of tables) {
        const found = await db.query(`SELECT to_regclass(format('%I.%I',$1::text,$2::text)) AS name`, [schema(), table]);
        expect(found.rows[0].name).not.toBeNull();
      }
      const ids = await seed();
      expect(
        (await db.query(`SELECT count(*)::integer AS count FROM beauty_position_assignments WHERE user_id=$1`, [ids.user])).rows[0]
          .count,
      ).toBe(0);
    }));

  it('принимает только Beauty-должности и совместимые организацию, членство, бизнес, филиал и должность', async () =>
    rollback(async () => {
      const ids = await seed();
      await insertPosition(ids);
      await savepoint(async () => {
        await expect(
          db.query(`INSERT INTO beauty_positions(id,business_id,name,revision,updated_at) VALUES($1,$2,'Отель',1,now())`, [
            randomUUID(),
            ids.hospitality,
          ]),
        ).rejects.toThrow(/Beauty business required/);
      });

      const invalidAssignments: Array<[string, unknown[]]> = [
        [
          `INSERT INTO beauty_position_assignments(id,user_id,organization_id,business_id,position_id,location_id,revision,updated_at)
           VALUES($1,$2,$3,$4,$5,$6,1,now())`,
          [randomUUID(), ids.foreignUser, ids.org, ids.business, ids.position, ids.location],
        ],
        [
          `INSERT INTO beauty_position_assignments(id,user_id,organization_id,business_id,position_id,location_id,revision,updated_at)
           VALUES($1,$2,$3,$4,$5,$6,1,now())`,
          [randomUUID(), ids.user, ids.otherOrg, ids.business, ids.position, ids.location],
        ],
        [
          `INSERT INTO beauty_position_assignments(id,user_id,organization_id,business_id,position_id,location_id,revision,updated_at)
           VALUES($1,$2,$3,$4,$5,$6,1,now())`,
          [randomUUID(), ids.user, ids.org, ids.otherBusiness, ids.position, ids.otherLocation],
        ],
        [
          `INSERT INTO beauty_position_assignments(id,user_id,organization_id,business_id,position_id,location_id,revision,updated_at)
           VALUES($1,$2,$3,$4,$5,$6,1,now())`,
          [randomUUID(), ids.user, ids.org, ids.business, ids.position, ids.otherLocation],
        ],
        [
          `INSERT INTO beauty_position_assignments(id,user_id,organization_id,business_id,position_id,location_id,revision,updated_at)
           VALUES($1,$2,$3,$4,$5,$6,1,now())`,
          [randomUUID(), ids.owner, ids.org, ids.business, ids.position, ids.location],
        ],
      ];
      for (const [statement, args] of invalidAssignments)
        await savepoint(async () => {
          await expect(db.query(statement, args)).rejects.toThrow(/membership|organization|business|location|position|owner/i);
        });
      await expect(insertAssignment(ids)).resolves.toBeUndefined();
    }));

  it('назначение не расширяет membership scope бизнеса или филиала', async () =>
    rollback(async () => {
      const ids = await seed();
      await insertPosition(ids);
      await db.query(
        `INSERT INTO membership_scopes(id,organization_id,user_id,role,business_id,location_id)
         VALUES($1,$2,$3,'STAFF',$4,$5)`,
        [randomUUID(), ids.org, ids.user, ids.otherBusiness, ids.otherLocation],
      );
      await savepoint(async () => {
        await expect(insertAssignment(ids)).rejects.toThrow(/outside membership scope/);
      });
      await db.query(`DELETE FROM membership_scopes WHERE user_id=$1 AND organization_id=$2`, [ids.user, ids.org]);
      await db.query(
        `INSERT INTO membership_scopes(id,organization_id,user_id,role,business_id,location_id)
         VALUES($1,$2,$3,'STAFF',$4,NULL)`,
        [randomUUID(), ids.org, ids.user, ids.business],
      );
      await expect(insertAssignment(ids)).resolves.toBeUndefined();
    }));

  it('ограничивает матрицу разделами и действиями, refund только finance BUSINESS, OWN только view своей работы', async () =>
    rollback(async () => {
      const ids = await seed();
      await insertPosition(ids);
      for (const section of ['journal', 'appointments', 'payroll', 'reviews'])
        await expect(
          db.query(
            `INSERT INTO beauty_position_permissions(position_id,section,action,scope) VALUES($1,$2,'view','OWN')`,
            [ids.position, section],
          ),
        ).resolves.toMatchObject({ rowCount: 1 });
      await expect(
        db.query(
          `INSERT INTO beauty_position_permissions(position_id,section,action,scope) VALUES($1,'finance','refund','BUSINESS')`,
          [ids.position],
        ),
      ).resolves.toMatchObject({ rowCount: 1 });

      for (const [section, action, scope] of [
        ['finance', 'view', 'OWN'],
        ['customers', 'view', 'OWN'],
        ['appointments', 'update', 'OWN'],
        ['appointments', 'refund', 'BUSINESS'],
        ['finance', 'refund', 'OWN'],
        ['unknown', 'view', 'BUSINESS'],
        ['journal', 'publish', 'BUSINESS'],
      ])
        await savepoint(async () => {
          await expect(
            db.query(
              `INSERT INTO beauty_position_permissions(position_id,section,action,scope) VALUES($1,$2,$3,$4)`,
              [ids.position, section, action, scope],
            ),
          ).rejects.toThrow(/check constraint/);
        });
      await expect(
        db.query(
          `INSERT INTO beauty_position_permissions(position_id,section,action,scope) VALUES($1,'journal','view','BUSINESS')`,
          [ids.position],
        ),
      ).rejects.toThrow(/unique constraint/);
    }));

  it('хранит отозванное назначение, блокирует физическое удаление и изменение неизменяемой области', async () =>
    rollback(async () => {
      const ids = await seed();
      await insertPosition(ids);
      await insertAssignment(ids);
      await db.query(`UPDATE beauty_position_assignments SET revoked_at=now(),revision=2,updated_at=now() WHERE id=$1`, [ids.assignment]);
      const revoked = await db.query(
        `SELECT revision,revoked_at IS NOT NULL AS revoked FROM beauty_position_assignments WHERE id=$1`,
        [ids.assignment],
      );
      expect(revoked.rows[0]).toEqual({ revision: 2, revoked: true });
      await savepoint(async () => {
        await expect(db.query(`DELETE FROM beauty_position_assignments WHERE id=$1`, [ids.assignment])).rejects.toThrow(
          /assignments are retained/,
        );
      });
      for (const [column, value] of [
        ['user_id', ids.owner],
        ['organization_id', ids.otherOrg],
        ['business_id', ids.otherBusiness],
        ['location_id', ids.otherLocation],
      ])
        await savepoint(async () => {
          await expect(
            db.query(`UPDATE beauty_position_assignments SET ${column}=$1,revision=3,updated_at=now() WHERE id=$2`, [
              value,
              ids.assignment,
            ]),
          ).rejects.toThrow(/immutable/);
        });
    }));

  it('не архивирует должность с активным назначением и не активирует отозванное назначение архивной должности', async () =>
    rollback(async () => {
      const ids = await seed();
      await insertPosition(ids);
      await insertAssignment(ids);
      await savepoint(async () => {
        await expect(
          db.query(`UPDATE beauty_positions SET archived_at=now(),revision=2,updated_at=now() WHERE id=$1`, [ids.position]),
        ).rejects.toThrow(/active assignment/);
      });
      await db.query(`UPDATE beauty_position_assignments SET revoked_at=now(),revision=2,updated_at=now() WHERE id=$1`, [ids.assignment]);
      await expect(
        db.query(`UPDATE beauty_positions SET archived_at=now(),revision=2,updated_at=now() WHERE id=$1`, [ids.position]),
      ).resolves.toMatchObject({ rowCount: 1 });
      await expect(
        db.query(`UPDATE beauty_position_assignments SET revoked_at=NULL,revision=3,updated_at=now() WHERE id=$1`, [ids.assignment]),
      ).rejects.toThrow(/archived position/);
    }));

  it('сериализует параллельную архивацию должности и активацию назначения', async () => {
    const archiveDb = new pg.Client({ connectionString: url, options: `-c search_path=${schema()},public` });
    const assignmentDb = new pg.Client({ connectionString: url, options: `-c search_path=${schema()},public` });
    const ids = { org: randomUUID(), user: randomUUID(), business: randomUUID(), position: randomUUID(), assignment: randomUUID() };
    await archiveDb.connect();
    await assignmentDb.connect();
    try {
      await db.query(`INSERT INTO organizations(id,name) VALUES($1,'Beauty position race synthetic')`, [ids.org]);
      await db.query(`INSERT INTO users(id,email,email_verified_at) VALUES($1,$2,now())`, [
        ids.user,
        `beauty-position-race-${ids.user}@example.test`,
      ]);
      await db.query(`INSERT INTO memberships(user_id,organization_id,role) VALUES($1,$2,'STAFF')`, [ids.user, ids.org]);
      await db.query(
        `INSERT INTO businesses(id,organization_id,name,vertical,updated_at)
         VALUES($1,$2,'Beauty position race','BEAUTY',now())`,
        [ids.business, ids.org],
      );
      await db.query(
        `INSERT INTO beauty_positions(id,business_id,name,revision,updated_at) VALUES($1,$2,'Мастер',1,now())`,
        [ids.position, ids.business],
      );

      await archiveDb.query('BEGIN');
      await assignmentDb.query('BEGIN');
      await archiveDb.query(`UPDATE beauty_positions SET archived_at=now(),revision=2,updated_at=now() WHERE id=$1`, [ids.position]);
      const assignmentPid = (await assignmentDb.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;
      let assignmentOutcome: { ok: true } | { ok: false; error: Error } | undefined;
      const pendingAssignment = assignmentDb
        .query(
          `INSERT INTO beauty_position_assignments
            (id,user_id,organization_id,business_id,position_id,location_id,revision,updated_at)
           VALUES($1,$2,$3,$4,$5,NULL,1,now())`,
          [ids.assignment, ids.user, ids.org, ids.business, ids.position],
        )
        .then(
          () => ({ ok: true }) as const,
          (error: Error) => ({ ok: false, error }) as const,
        );
      void pendingAssignment.then((outcome) => {
        assignmentOutcome = outcome;
      });

      let waitsForPositionLock = false;
      const lockDeadline = Date.now() + 1_000;
      while (Date.now() < lockDeadline && assignmentOutcome === undefined) {
        const activity = await db.query<{ wait_event_type: string | null }>(
          `SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1`,
          [assignmentPid],
        );
        if (activity.rows[0]?.wait_event_type === 'Lock') {
          waitsForPositionLock = true;
          break;
        }
        await new Promise((resolveWait) => setTimeout(resolveWait, 25));
      }
      expect(assignmentOutcome).toBeUndefined();
      expect(waitsForPositionLock).toBe(true);

      await archiveDb.query('COMMIT');
      const result = await pendingAssignment;
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toMatch(/archived position/);
      await assignmentDb.query('ROLLBACK');
    } finally {
      await archiveDb.query('ROLLBACK').catch(() => undefined);
      await assignmentDb.query('ROLLBACK').catch(() => undefined);
      await archiveDb.end();
      await assignmentDb.end();
      await db.query(`DELETE FROM beauty_positions WHERE id=$1`, [ids.position]);
      await db.query(`DELETE FROM businesses WHERE id=$1`, [ids.business]);
      await db.query(`DELETE FROM memberships WHERE user_id=$1 AND organization_id=$2`, [ids.user, ids.org]);
      await db.query(`DELETE FROM organizations WHERE id=$1`, [ids.org]);
      await db.query(`DELETE FROM users WHERE id=$1`, [ids.user]);
    }
  });

  it('сохраняет единственную строку области, включая отозванную, и требует положительную revision', async () =>
    rollback(async () => {
      const ids = await seed();
      await insertPosition(ids);
      await insertAssignment(ids);
      await db.query(`UPDATE beauty_position_assignments SET revoked_at=now(),revision=2,updated_at=now() WHERE id=$1`, [ids.assignment]);
      await savepoint(async () => {
        await expect(
          db.query(
            `INSERT INTO beauty_position_assignments
              (id,user_id,organization_id,business_id,position_id,location_id,revision,updated_at)
             VALUES($1,$2,$3,$4,$5,$6,1,now())`,
            [randomUUID(), ids.user, ids.org, ids.business, ids.position, ids.location],
          ),
        ).rejects.toThrow(/unique constraint/);
      });
      await savepoint(async () => {
        await expect(
          db.query(`UPDATE beauty_position_assignments SET revision=0,updated_at=now() WHERE id=$1`, [ids.assignment]),
        ).rejects.toThrow(/check constraint/);
      });
      await expect(db.query(`UPDATE beauty_positions SET revision=0,updated_at=now() WHERE id=$1`, [ids.position])).rejects.toThrow(
        /check constraint/,
      );
    }));

  it('RLS показывает приложению только арендатора, а запись оставляет service-роли', async () =>
    rollback(async () => {
      const own = await seed();
      await insertPosition(own, 'Администратор');
      await insertAssignment(own);
      await db.query(
        `INSERT INTO beauty_position_permissions(position_id,section,action,scope) VALUES($1,'finance','refund','BUSINESS')`,
        [own.position],
      );
      const other = await seed();
      other.position = randomUUID();
      other.assignment = randomUUID();
      other.business = other.foreignBusiness;
      other.location = other.foreignLocation;
      other.org = other.otherOrg;
      other.user = other.foreignUser;
      await insertPosition(other, 'Иностранная должность');
      await insertAssignment(other);
      await db.query(
        `INSERT INTO beauty_position_permissions(position_id,section,action,scope) VALUES($1,'journal','view','BUSINESS')`,
        [other.position],
      );

      for (const tenant of [own.org, other.org, ''])
        await savepoint(async () => {
          await db.query('SET LOCAL ROLE wetop_app');
          await db.query(`SELECT set_config('app.org_id',$1,true)`, [tenant]);
          for (const table of tables) {
            const result = await db.query(`SELECT count(*)::integer AS count FROM ${table}`);
            expect(result.rows[0].count).toBe(tenant ? 1 : 0);
          }
          await expect(
            db.query(`INSERT INTO beauty_positions(id,business_id,name,revision,updated_at) VALUES($1,$2,'Запрещено',1,now())`, [
              randomUUID(),
              own.business,
            ]),
          ).rejects.toThrow(/permission denied/);
        });

      await savepoint(async () => {
        await db.query('SET LOCAL ROLE wetop_service');
        await expect(
          db.query(`INSERT INTO beauty_positions(id,business_id,name,revision,updated_at) VALUES($1,$2,'Сервис',1,now())`, [
            randomUUID(),
            own.business,
          ]),
        ).resolves.toMatchObject({ rowCount: 1 });
      });
    }));

  it('закрепляет trigger-функции в текущей схеме и охраняет откат от любых сохранённых данных', async () =>
    rollback(async () => {
      const functions = await db.query(
        `SELECT proname,proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
         WHERE n.nspname=$1 AND proname IN ('beauty_position_guard','beauty_position_assignment_guard','beauty_position_assignment_retain')`,
        [schema()],
      );
      expect(functions.rowCount).toBe(3);
      for (const row of functions.rows as Array<{ proconfig: string[] | null }>)
        expect(row.proconfig?.some((value) => value.startsWith('search_path='))).toBe(true);

      const down = readFileSync(
        resolve(process.cwd(), 'packages/database/prisma/migrations/20261018000136_beauty_positions/down.sql'),
        'utf8',
      )
        .replace(/^BEGIN;\s*/, '')
        .replace(/\s*COMMIT;\s*$/, '');
      const ids = await seed();
      await insertPosition(ids);
      await savepoint(async () => {
        await expect(db.query(down)).rejects.toThrow(/Export Beauty positions, permissions and assignments before rollback/);
      });
      await db.query(`DELETE FROM beauty_positions WHERE id=$1`, [ids.position]);
      await savepoint(async () => {
        await db.query(down);
        for (const table of tables)
          expect((await db.query(`SELECT to_regclass(format('%I.%I',$1::text,$2::text)) AS name`, [schema(), table])).rows[0].name).toBeNull();
      });
    }));
});
