import { hashPassword } from '@pms/domain';

/**
 * Подставная база для тестов входа: только те операции, которыми пользуется AuthService.
 * Настоящую базу проверяет tests/integration/accounts-columns.test.ts (ограничения и внешние ключи).
 */
export interface FakeUser {
  id: string;
  email: string;
  passwordHash: string;
  name: string | null;
  status: 'ACTIVE' | 'BLOCKED';
  failedAttempts: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
}

export interface FakeMembership {
  userId: string;
  organizationId: string;
  createdAt: Date;
}

export interface FakeSession {
  id: string;
  userId: string;
  organizationId: string;
  tokenHash: string;
  userAgent: string | null;
  issuedAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface FakeReset {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
}

export interface AuditRow {
  userId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  after: unknown;
}

export const FAKE_ORG = 'org-1';

export interface FakeOrganization {
  id: string;
  name: string;
  status: 'TRIAL' | 'ACTIVE' | 'READ_ONLY' | 'SUSPENDED';
  trialEndsAt: Date | null;
}

export function fakeUser(over: Partial<FakeUser> = {}): FakeUser {
  return {
    id: 'u-1',
    email: 'admin@example.invalid',
    passwordHash: hashPassword('luxx-stoika-2026'),
    name: 'Айгуль Тестова',
    status: 'ACTIVE',
    failedAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    ...over,
  };
}

export function fakeDb(users: FakeUser[] = [fakeUser()]) {
  const sessions: FakeSession[] = [];
  const resets: FakeReset[] = [];
  const audit: AuditRow[] = [];
  // каждый заведённый человек состоит в одной организации — так его пускает §13.3
  const memberships: FakeMembership[] = users.map((u) => ({
    userId: u.id,
    organizationId: FAKE_ORG,
    createdAt: new Date('2026-09-15T00:00:00Z'),
  }));
  const organizations: FakeOrganization[] = [
    {
      id: FAKE_ORG,
      name: 'Тестовый хостел',
      status: 'TRIAL',
      trialEndsAt: new Date('2026-09-22T00:00:00Z'),
    },
  ];
  let seq = 0;

  const db = {
    organization: {
      async findUnique({ where }: { where: { id: string } }) {
        const row = organizations.find((o) => o.id === where.id);
        return row ? { ...row } : null;
      },
      async create({ data }: { data: Omit<FakeOrganization, 'id'> }) {
        seq += 1;
        const row: FakeOrganization = { id: `org-${seq + 1}`, ...data };
        organizations.push(row);
        return { ...row };
      },
    },
    user: {
      async findUnique({
        where,
        include,
      }: {
        where: { email?: string; id?: string };
        include?: { memberships?: unknown };
      }) {
        const found = users.find(
          (u) =>
            (where.email !== undefined && u.email === where.email) ||
            (where.id !== undefined && u.id === where.id),
        );
        if (!found) return null;
        if (!include?.memberships) return { ...found };
        return { ...found, memberships: memberships.filter((m) => m.userId === found.id) };
      },
      async update({ where, data }: { where: { id: string }; data: Partial<FakeUser> }) {
        const user = users.find((u) => u.id === where.id);
        if (!user) throw new Error('нет такого пользователя');
        Object.assign(user, data);
        return { ...user };
      },
      async create({
        data,
      }: {
        data: Omit<FakeUser, 'id' | 'failedAttempts' | 'lockedUntil'> & {
          lastLoginAt?: Date | null;
        };
      }) {
        if (users.some((u) => u.email === data.email)) {
          // Так отвечает Postgres на нарушение уникальности users.email; регистрация ловит именно код.
          throw Object.assign(new Error('почта занята'), { code: 'P2002' });
        }
        seq += 1;
        const row: FakeUser = {
          id: `u-${seq + 1}`,
          failedAttempts: 0,
          lockedUntil: null,
          ...data,
          lastLoginAt: data.lastLoginAt ?? null,
        };
        users.push(row);
        return { ...row };
      },
    },
    passwordReset: {
      async create({ data }: { data: Omit<FakeReset, 'id' | 'usedAt'> }) {
        seq += 1;
        const row: FakeReset = { id: `r-${seq}`, usedAt: null, ...data };
        resets.push(row);
        return { ...row };
      },
      async findUnique({
        where,
        include,
      }: {
        where: { tokenHash: string };
        include?: { user: boolean };
      }) {
        const row = resets.find((r) => r.tokenHash === where.tokenHash);
        if (!row) return null;
        const user = users.find((u) => u.id === row.userId);
        return include?.user ? { ...row, user: user ? { ...user } : null } : { ...row };
      },
      async update({ where, data }: { where: { id: string }; data: Partial<FakeReset> }) {
        const row = resets.find((r) => r.id === where.id);
        if (!row) throw new Error('нет такой ссылки');
        Object.assign(row, data);
        return { ...row };
      },
      async updateMany({
        where,
        data,
      }: {
        where: { userId: string; usedAt: null };
        data: Partial<FakeReset>;
      }) {
        const hit = resets.filter((r) => r.userId === where.userId && r.usedAt === null);
        hit.forEach((r) => Object.assign(r, data));
        return { count: hit.length };
      },
    },
    membership: {
      async create({ data }: { data: { userId: string; organizationId: string } }) {
        const row: FakeMembership = { ...data, createdAt: new Date() };
        memberships.push(row);
        return { ...row };
      },
      async findFirst({ where }: { where: { userId: string } }) {
        return memberships.find((m) => m.userId === where.userId) ?? null;
      },
    },
    session: {
      async create({
        data,
      }: {
        data: Omit<FakeSession, 'id' | 'issuedAt' | 'lastSeenAt' | 'revokedAt'>;
      }) {
        seq += 1;
        const row: FakeSession = {
          id: `s-${seq}`,
          issuedAt: new Date(),
          lastSeenAt: new Date(),
          revokedAt: null,
          ...data,
          userAgent: data.userAgent ?? null,
        };
        sessions.push(row);
        return { ...row };
      },
      async findUnique({
        where,
        include,
      }: {
        where: { tokenHash: string };
        include?: { user?: boolean; organization?: boolean };
      }) {
        const row = sessions.find((s) => s.tokenHash === where.tokenHash);
        if (!row) return null;
        const user = users.find((u) => u.id === row.userId);
        const organization = organizations.find((o) => o.id === row.organizationId);
        return {
          ...row,
          ...(include?.user ? { user: user ? { ...user } : null } : {}),
          ...(include?.organization
            ? { organization: organization ? { ...organization } : null }
            : {}),
        };
      },
      async update({ where, data }: { where: { id: string }; data: Partial<FakeSession> }) {
        const row = sessions.find((s) => s.id === where.id);
        if (!row) throw new Error('нет такой сессии');
        Object.assign(row, data);
        return { ...row };
      },
      async updateMany({
        where,
        data,
      }: {
        where: { userId: string; revokedAt: null; id?: { not: string } };
        data: Partial<FakeSession>;
      }) {
        const hit = sessions.filter(
          (s) =>
            s.userId === where.userId &&
            s.revokedAt === null &&
            (!where.id || s.id !== where.id.not),
        );
        hit.forEach((s) => Object.assign(s, data));
        return { count: hit.length };
      },
      async count({ where }: { where: { userId: string; revokedAt: null } }) {
        return sessions.filter((s) => s.userId === where.userId && s.revokedAt === null).length;
      },
    },
    auditLog: {
      async create({ data }: { data: AuditRow }) {
        audit.push(data);
        return { id: `a-${audit.length}`, ...data };
      },
    },
  };

  /**
   * Транзакция у подставной базы. Откат нужен по-настоящему: регистрация заводит организацию раньше
   * человека, и если почта занята, снаружи не должно остаться пустой организации. Подставная база
   * без отката показала бы зелёное там, где настоящая база права, — поэтому откат здесь есть:
   * запоминаем длины таблиц до вызова и обрезаем их обратно, если внутри бросили.
   * Присваивается после объявления: внутри собственного литерала `db` сослаться на себя не может.
   */
  Object.assign(db, {
    async $transaction<T>(fn: (tx: typeof db) => Promise<T>): Promise<T> {
      const before = [organizations, users, memberships, sessions, resets, audit].map(
        (t) => t.length,
      );
      try {
        return await fn(db);
      } catch (e) {
        [organizations, users, memberships, sessions, resets, audit].forEach((table, i) =>
          table.splice(before[i]!),
        );
        throw e;
      }
    },
  });

  return {
    prisma: { db } as never,
    users,
    sessions,
    resets,
    memberships,
    organizations,
    audit,
    db,
  };
}
