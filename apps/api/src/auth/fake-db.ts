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
  /** NULL — почта не подтверждена: вход закрыт (решение владельца 20.09.2026) */
  emailVerifiedAt: Date | null;
}

export interface FakeMembership {
  userId: string;
  organizationId: string;
  /** DATA_MODEL §16.1: в базе по умолчанию `STAFF` */
  role: 'OWNER' | 'STAFF';
  createdAt: Date;
}

/** Главный администратор платформы (DATA_MODEL §16.2) */
export interface FakePlatformAdmin {
  userId: string;
  grantedAt: Date;
  revokedAt: Date | null;
  note: string | null;
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

/** Ссылка подтверждения почты — устроена так же, как ссылка на пароль. */
export type FakeVerification = FakeReset;

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

export interface FakeProperty {
  id: string;
  organizationId: string | null;
  name: string;
  timezone: string;
  currency: string;
  checkInTime: string;
  checkOutTime: string;
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
    // По умолчанию человек подтверждён: тесты входа про пароль, а не про письмо.
    // Неподтверждённого заводят явно — `fakeUser({ emailVerifiedAt: null })`.
    emailVerifiedAt: new Date('2026-09-15T00:00:00Z'),
    ...over,
  };
}

export function fakeDb(users: FakeUser[] = [fakeUser()]) {
  const sessions: FakeSession[] = [];
  const resets: FakeReset[] = [];
  const verifications: FakeVerification[] = [];
  const audit: AuditRow[] = [];
  const properties: FakeProperty[] = [];
  // каждый заведённый человек состоит в одной организации — так его пускает §13.3; первый — её владелец (§16.1)
  const memberships: FakeMembership[] = users.map((u, i) => ({
    userId: u.id,
    organizationId: FAKE_ORG,
    role: i === 0 ? 'OWNER' : 'STAFF',
    createdAt: new Date('2026-09-15T00:00:00Z'),
  }));
  const platformAdmins: FakePlatformAdmin[] = [];
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
    property: {
      async create({ data }: { data: Omit<FakeProperty, 'id'> }) {
        seq += 1;
        const row: FakeProperty = { id: `prop-${seq}`, ...data };
        properties.push(row);
        return { ...row };
      },
      async findFirst({
        where,
      }: {
        where: { organizationId?: string; name?: string | { equals: string; mode: 'insensitive' } };
      }) {
        const sameName = (name: string) =>
          where.name === undefined ||
          (typeof where.name === 'string'
            ? name === where.name
            : name.toLowerCase() === where.name.equals.toLowerCase());
        const row = properties.find(
          (pr) =>
            (where.organizationId === undefined || pr.organizationId === where.organizationId) &&
            sameName(pr.name),
        );
        return row ? { ...row } : null;
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
      async update({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<Omit<FakeUser, 'failedAttempts'>> & {
          failedAttempts?: number | { increment: number };
        };
        select?: Record<string, boolean>;
      }) {
        const user = users.find((u) => u.id === where.id);
        if (!user) throw new Error('нет такого пользователя');
        const { failedAttempts, ...rest } = data;
        Object.assign(user, rest);
        if (typeof failedAttempts === 'number') user.failedAttempts = failedAttempts;
        // атомарный счётчик промахов, как `{ increment }` у Prisma (С-5): прибавка к текущему значению в «базе»
        if (typeof failedAttempts === 'object' && failedAttempts !== null)
          user.failedAttempts += failedAttempts.increment;
        return { ...user };
      },
      async create({
        data,
      }: {
        data: Omit<
          FakeUser,
          'id' | 'failedAttempts' | 'lockedUntil' | 'lastLoginAt' | 'emailVerifiedAt'
        > & {
          lastLoginAt?: Date | null;
          emailVerifiedAt?: Date | null;
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
          // поле есть и в `data`, поэтому умолчание ставится после раскрытия, а не до него
          lastLoginAt: data.lastLoginAt ?? null,
          // Заведённый через API человек почту ещё не подтверждал — как в настоящей базе
          emailVerifiedAt: data.emailVerifiedAt ?? null,
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
    emailVerification: {
      async create({ data }: { data: Omit<FakeVerification, 'id' | 'usedAt'> }) {
        seq += 1;
        const row: FakeVerification = { id: `v-${seq}`, usedAt: null, ...data };
        verifications.push(row);
        return { ...row };
      },
      async findUnique({
        where,
        include,
      }: {
        where: { tokenHash: string };
        // Подтверждение зовёт с вложенным include: человек и его членство одним запросом
        include?: { user: boolean | { include?: { memberships?: unknown } } };
      }) {
        const row = verifications.find((r) => r.tokenHash === where.tokenHash);
        if (!row) return null;
        if (!include?.user) return { ...row };
        const user = users.find((u) => u.id === row.userId);
        if (!user) return { ...row, user: null };
        return {
          ...row,
          user: { ...user, memberships: memberships.filter((m) => m.userId === user.id) },
        };
      },
      async update({ where, data }: { where: { id: string }; data: Partial<FakeVerification> }) {
        const row = verifications.find((r) => r.id === where.id);
        if (!row) throw new Error('нет такой ссылки подтверждения');
        Object.assign(row, data);
        return { ...row };
      },
      async updateMany({
        where,
        data,
      }: {
        where: { userId: string; usedAt: null };
        data: Partial<FakeVerification>;
      }) {
        const hit = verifications.filter((r) => r.userId === where.userId && r.usedAt === null);
        hit.forEach((r) => Object.assign(r, data));
        return { count: hit.length };
      },
    },
    membership: {
      async create({
        data,
      }: {
        data: { userId: string; organizationId: string; role?: 'OWNER' | 'STAFF' };
      }) {
        const row: FakeMembership = { role: 'STAFF', ...data, createdAt: new Date() };
        memberships.push(row);
        return { ...row };
      },
      async findFirst({ where }: { where: { userId: string } }) {
        return memberships.find((m) => m.userId === where.userId) ?? null;
      },
      async findUnique({
        where,
      }: {
        where: { userId_organizationId: { userId: string; organizationId: string } };
      }) {
        const { userId, organizationId } = where.userId_organizationId;
        const row = memberships.find((m) => m.userId === userId && m.organizationId === organizationId);
        return row ? { ...row } : null;
      },
    },
    platformAdmin: {
      async findUnique({ where }: { where: { userId: string } }) {
        const row = platformAdmins.find((a) => a.userId === where.userId);
        return row ? { ...row } : null;
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
      const before = [
        organizations,
        properties,
        users,
        memberships,
        sessions,
        resets,
        verifications,
        audit,
      ].map((t) => t.length);
      try {
        return await fn(db);
      } catch (e) {
        [
          organizations,
          properties,
          users,
          memberships,
          sessions,
          resets,
          verifications,
          audit,
        ].forEach((table, i) => table.splice(before[i]!));
        throw e;
      }
    },
  });

  return {
    prisma: { db } as never,
    users,
    sessions,
    resets,
    verifications,
    memberships,
    platformAdmins,
    properties,
    organizations,
    audit,
    db,
  };
}
