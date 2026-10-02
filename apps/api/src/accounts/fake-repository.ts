/**
 * Хранилище учётных записей в памяти — для тестов контроллера. В общий индекс модуля не входит.
 * Ведёт себя как настоящее в том, что важно проверкам: считает коды за час, помнит попытки,
 * гасит использованный код, отзывает сессии.
 */
import type { MembershipRole } from '@pms/domain';
import type {
  AccountRecord,
  AccountsRepository,
  InviteRecord,
  MemberRecord,
  MemberWrite,
  SessionListRecord,
  SessionRecord,
} from './accounts.repository';

export const ACCOUNT: AccountRecord = {
  userId: 'u-1',
  email: 'urij@example.com',
  organizationId: 'org-1',
  organizationName: 'Хостел «Пример»',
  organizationStatus: 'TRIAL',
  trialEndsAt: new Date('2026-09-23T12:00:00.000Z'),
  role: 'OWNER',
};

interface StoredSession {
  id: string;
  tokenHash: string;
  userId: string;
  organizationId: string;
  issuedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  userAgent: string | null;
}

export class FakeAccountsRepository implements AccountsRepository {
  readonly sessions: StoredSession[] = [];
  readonly logins: Array<{ userId: string; at: Date }> = [];
  accounts: AccountRecord[] = [ACCOUNT];
  private seq = 0;

  async accountByEmail(email: string): Promise<AccountRecord | null> {
    return this.accounts.find((a) => a.email === email) ?? null;
  }

  async createAccount(input: {
    email: string;
    organizationName: string;
    trialEndsAt: Date;
  }): Promise<AccountRecord | null> {
    if (this.accounts.some((a) => a.email === input.email)) return null;
    this.seq += 1;
    const account: AccountRecord = {
      userId: `u-${this.seq}`,
      email: input.email,
      organizationId: `org-${this.seq}`,
      organizationName: input.organizationName,
      organizationStatus: 'TRIAL',
      trialEndsAt: input.trialEndsAt,
      role: 'OWNER',
    };
    this.accounts.push(account);
    return account;
  }

  async markLogin(userId: string, at: Date): Promise<void> {
    this.logins.push({ userId, at });
  }

  async sessionsForUser(userId: string, now: Date): Promise<SessionListRecord[]> {
    return this.sessions
      .filter((s) => s.userId === userId && s.revokedAt === null && s.expiresAt > now)
      .sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime() || b.id.localeCompare(a.id))
      .map((s) => ({
        id: s.id,
        tokenHash: s.tokenHash,
        issuedAt: s.issuedAt,
        expiresAt: s.expiresAt,
        userAgent: s.userAgent,
      }));
  }

  async revokeAllSessions(userId: string, at: Date): Promise<number> {
    let n = 0;
    for (const s of this.sessions) {
      if (s.userId === userId && s.revokedAt === null && s.expiresAt > at) {
        s.revokedAt = at;
        n += 1;
      }
    }
    return n;
  }

  /**
   * Завести сессию. В боевом репозитории такого метода больше нет: сессии заводит AuthService
   * своей таблицей (ADR-053, вход по коду снят). Здесь он остался как средство подготовки тестов —
   * им сеются живые ключи для проверок «где я вошёл», «выйти везде» и приглашений.
   */
  async createSession(input: {
    tokenHash: string;
    userId: string;
    organizationId: string;
    expiresAt: Date;
    userAgent: string | null;
  }): Promise<void> {
    this.seq += 1;
    this.sessions.push({ ...input, id: `s-${this.seq}`, issuedAt: new Date(), revokedAt: null });
  }

  /** Как настоящее хранилище: членство сняли — строка есть, но `member: false` и роль «администратор» */
  async sessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const s = this.sessions.find((x) => x.tokenHash === tokenHash);
    if (!s) return null;
    const membership = this.accounts.find(
      (x) => x.userId === s.userId && x.organizationId === s.organizationId,
    );
    const a = membership ?? this.accounts.find((x) => x.userId === s.userId) ?? this.gone.get(s.userId);
    if (!a) return null;
    return {
      userId: a.userId,
      email: a.email,
      organizationId: s.organizationId,
      organizationName: a.organizationName,
      organizationStatus: a.organizationStatus,
      trialEndsAt: a.trialEndsAt,
      expiresAt: s.expiresAt,
      revokedAt: s.revokedAt,
      role: membership?.role ?? 'STAFF',
      userStatus: this.blocked.has(a.userId) ? 'BLOCKED' : 'ACTIVE',
      member: membership !== undefined,
    };
  }

  /** Люди, чьё членство сняли: сам человек (строка `users`) остаётся — сессия находит его, но не членство */
  private readonly gone = new Map<string, AccountRecord>();

  async revokeSession(tokenHash: string, at: Date): Promise<void> {
    const s = this.sessions.find((x) => x.tokenHash === tokenHash);
    if (s && s.revokedAt === null) s.revokedAt = at;
  }

  // ── Приглашения (этап 7) ────────────────────────────────────────────────────────────────────
  readonly invites: StoredInvite[] = [];

  async createInvite(input: {
    organizationId: string;
    email: string;
    tokenHash: string;
    expiresAt: Date;
    createdBy: string;
    role: MembershipRole;
  }): Promise<InviteRecord> {
    this.seq += 1;
    const org = this.accounts.find((a) => a.organizationId === input.organizationId);
    const stored: StoredInvite = {
      id: `i-${this.seq}`,
      organizationId: input.organizationId,
      organizationName: org?.organizationName ?? input.organizationId,
      email: input.email,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      acceptedAt: null,
      createdBy: input.createdBy,
      createdAt: new Date(),
      role: input.role,
    };
    this.invites.push(stored);
    return toInviteRecord(stored);
  }

  async pendingInvites(organizationId: string, now: Date): Promise<InviteRecord[]> {
    return this.invites
      .filter(
        (i) => i.organizationId === organizationId && i.acceptedAt === null && i.expiresAt > now,
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(toInviteRecord);
  }

  async inviteByTokenHash(tokenHash: string): Promise<InviteRecord | null> {
    const i = this.invites.find((x) => x.tokenHash === tokenHash);
    return i ? toInviteRecord(i) : null;
  }

  async markInviteAccepted(id: string, at: Date): Promise<void> {
    const i = this.invites.find((x) => x.id === id);
    if (i && i.acceptedAt === null) i.acceptedAt = at;
  }

  async invitesCreatedSince(organizationId: string, since: Date): Promise<number> {
    return this.invites.filter((i) => i.organizationId === organizationId && i.createdAt >= since)
      .length;
  }

  async revokeInvite(
    id: string,
    organizationId: string,
    at: Date,
    roles: readonly MembershipRole[],
  ): Promise<boolean> {
    const i = this.invites.find(
      (x) =>
        x.id === id &&
        x.organizationId === organizationId &&
        x.acceptedAt === null &&
        x.expiresAt > at &&
        roles.includes(x.role),
    );
    if (!i) return false;
    i.expiresAt = at;
    return true;
  }

  async isMember(email: string, organizationId: string): Promise<boolean> {
    return this.accounts.some((a) => a.email === email && a.organizationId === organizationId);
  }

  /** Подделка держит одну строку на членство: тот же человек в другой организации — ещё одна строка. */
  async joinOrganization(input: {
    email: string;
    organizationId: string;
    role: MembershipRole;
  }): Promise<AccountRecord> {
    const existing = this.accounts.find(
      (a) => a.email === input.email && a.organizationId === input.organizationId,
    );
    if (existing) return existing;
    const org = this.accounts.find((a) => a.organizationId === input.organizationId);
    const sameUser = this.accounts.find((a) => a.email === input.email);
    if (!sameUser) this.seq += 1;
    const account: AccountRecord = {
      userId: sameUser?.userId ?? `u-${this.seq}`,
      email: input.email,
      organizationId: input.organizationId,
      organizationName: org?.organizationName ?? input.organizationId,
      organizationStatus: org?.organizationStatus ?? 'TRIAL',
      trialEndsAt: org?.trialEndsAt ?? null,
      role: input.role,
    };
    this.accounts.push(account);
    return account;
  }

  // ── Сотрудники (ADR-107) ────────────────────────────────────────────────────────────────────
  /** Заблокированные люди (`users.status = BLOCKED`) */
  readonly blocked = new Set<string>();
  /** Роль «в базе» в момент записи, если она уже не та, что показал список: так выглядит гонка с владельцем */
  readonly roleOverride = new Map<string, MembershipRole>();
  /** Что ушло бы в журнал при отключении и смене роли — проверкам видно, кто и кого */
  readonly removed: Array<{ organizationId: string; userId: string; by: string }> = [];
  readonly roleChanges: Array<{
    organizationId: string;
    userId: string;
    before: MembershipRole;
    after: MembershipRole;
    by: string;
  }> = [];

  async members(organizationId: string): Promise<MemberRecord[]> {
    return this.accounts
      .filter((a) => a.organizationId === organizationId)
      .map((a) => ({
        userId: a.userId,
        email: a.email,
        name: null,
        role: a.role,
        joinedAt: new Date('2026-09-01T00:00:00.000Z'),
        // u-admin2 ещё не входил: список отдаёт null, а не undefined (TEAM1)
        lastLoginAt: a.userId === 'u-admin2' ? null : new Date('2026-09-20T10:00:00.000Z'),
      }));
  }

  async removeMember(input: {
    organizationId: string;
    userId: string;
    by: string;
    roles: readonly MembershipRole[];
  }): Promise<MemberWrite> {
    const at = this.accounts.findIndex(
      (a) => a.userId === input.userId && a.organizationId === input.organizationId,
    );
    if (at < 0) return { outcome: 'missing', role: null };
    const role = this.roleOverride.get(input.userId) ?? this.accounts[at]!.role;
    if (!input.roles.includes(role)) return { outcome: 'role', role };
    const [gone] = this.accounts.splice(at, 1);
    this.gone.set(input.userId, gone!);
    this.removed.push({ organizationId: input.organizationId, userId: input.userId, by: input.by });
    return { outcome: 'done', role };
  }

  async setMemberRole(input: {
    organizationId: string;
    userId: string;
    role: MembershipRole;
    by: string;
    from: readonly MembershipRole[];
  }): Promise<MemberWrite> {
    const a = this.accounts.find(
      (x) => x.userId === input.userId && x.organizationId === input.organizationId,
    );
    if (!a) return { outcome: 'missing', role: null };
    const before = this.roleOverride.get(input.userId) ?? a.role;
    if (!input.from.includes(before)) return { outcome: 'role', role: before };
    a.role = input.role;
    this.roleChanges.push({
      organizationId: input.organizationId,
      userId: input.userId,
      before,
      after: input.role,
      by: input.by,
    });
    return { outcome: 'done', role: before };
  }

  /** Ссылки «задайте пароль» для приглашённых: по ним видно, что ушло человеку, без настоящей базы. */
  passwordSetTokens: { email: string; tokenHash: string; expiresAt: Date }[] = [];
  /** У кого пароль уже задан — такому ссылку не выдаём (это был бы сброс по чужому приглашению). */
  withPassword = new Set<string>();

  async issuePasswordSetToken(input: {
    email: string;
    tokenHash: string;
    expiresAt: Date;
    now: Date;
  }): Promise<boolean> {
    const known = this.accounts.some((a) => a.email === input.email);
    if (!known || this.withPassword.has(input.email)) return false;
    // прежние неиспользованные гасим: живой остаётся одна
    this.passwordSetTokens = this.passwordSetTokens.filter((t) => t.email !== input.email);
    this.passwordSetTokens.push({
      email: input.email,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
    });
    return true;
  }
}

interface StoredInvite extends InviteRecord {
  tokenHash: string;
  createdBy: string;
}

function toInviteRecord(i: StoredInvite): InviteRecord {
  return {
    id: i.id,
    organizationId: i.organizationId,
    organizationName: i.organizationName,
    email: i.email,
    expiresAt: i.expiresAt,
    acceptedAt: i.acceptedAt,
    createdAt: i.createdAt,
    role: i.role,
  };
}
