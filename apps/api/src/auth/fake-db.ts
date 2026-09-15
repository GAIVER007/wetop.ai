import { hashPassword } from '@pms/domain';

/**
 * Подставная база для тестов входа: только те операции, которыми пользуется AuthService.
 * Настоящую базу проверяет tests/integration/accounts-columns.test.ts (ограничения и внешние ключи).
 */
export interface FakeUser {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: 'OWNER' | 'MANAGER' | 'DESK' | 'READONLY';
  status: 'INVITED' | 'ACTIVE' | 'BLOCKED';
  failedAttempts: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
}

export interface FakeSession {
  id: string;
  userId: string;
  tokenHash: string;
  userAgentFamily: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface AuditRow {
  userId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  after: unknown;
}

export function fakeUser(over: Partial<FakeUser> = {}): FakeUser {
  return {
    id: 'u-1',
    email: 'admin@example.invalid',
    passwordHash: hashPassword('luxx-stoika-2026'),
    fullName: 'Айгуль Тестова',
    role: 'DESK',
    status: 'ACTIVE',
    failedAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    ...over,
  };
}

export function fakeDb(users: FakeUser[] = [fakeUser()]) {
  const sessions: FakeSession[] = [];
  const audit: AuditRow[] = [];
  let seq = 0;

  const db = {
    user: {
      async findUnique({ where }: { where: { email?: string; id?: string } }) {
        const found = users.find(
          (u) => (where.email !== undefined && u.email === where.email) || (where.id !== undefined && u.id === where.id),
        );
        return found ? { ...found } : null;
      },
      async update({ where, data }: { where: { id: string }; data: Partial<FakeUser> }) {
        const user = users.find((u) => u.id === where.id);
        if (!user) throw new Error('нет такого пользователя');
        Object.assign(user, data);
        return { ...user };
      },
    },
    session: {
      async create({ data }: { data: Omit<FakeSession, 'id' | 'createdAt' | 'lastSeenAt' | 'revokedAt'> }) {
        seq += 1;
        const row: FakeSession = {
          id: `s-${seq}`,
          createdAt: new Date(),
          lastSeenAt: new Date(),
          revokedAt: null,
          ...data,
          userAgentFamily: data.userAgentFamily ?? null,
        };
        sessions.push(row);
        return { ...row };
      },
      async findUnique({ where, include }: { where: { tokenHash: string }; include?: { user: boolean } }) {
        const row = sessions.find((s) => s.tokenHash === where.tokenHash);
        if (!row) return null;
        const user = users.find((u) => u.id === row.userId);
        return include?.user ? { ...row, user: user ? { ...user } : null } : { ...row };
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
          (s) => s.userId === where.userId && s.revokedAt === null && (!where.id || s.id !== where.id.not),
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

  return { prisma: { db } as never, users, sessions, audit, db };
}
