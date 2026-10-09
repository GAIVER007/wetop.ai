/**
 * Хранилище учётных записей в памяти — для тестов контроллера. В общий индекс модуля не входит.
 * Ведёт себя как настоящее в том, что важно проверкам: считает коды за час, помнит попытки,
 * гасит использованный код, отзывает сессии.
 */
import { membershipRoleFor, type MembershipRole, type ScopeAssignment } from '@pms/domain';
import type {
  AccountRecord,
  AccountsRepository,
  InviteRecord,
  MemberRecord,
  MemberWrite,
  OrganizationStructure,
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
    const a =
      membership ?? this.accounts.find((x) => x.userId === s.userId) ?? this.gone.get(s.userId);
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
      member: membership !== undefined && !this.suspended.has(s.userId),
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
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    position?: string | null;
    scopes?: ScopeAssignment[];
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
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      phone: input.phone ?? null,
      position: input.position ?? null,
      scopes: input.scopes ?? [],
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

  async acceptInvite(input: {
    id: string;
    now: Date;
    passwordTokenHash: string;
    passwordExpiresAt: Date;
  }): Promise<{ passwordTokenIssued: boolean } | null> {
    const invite = this.invites.find(
      (i) => i.id === input.id && i.acceptedAt === null && i.expiresAt > input.now,
    );
    if (!invite) return null;
    invite.acceptedAt = input.now;
    const joined = await this.joinOrganization({
      email: invite.email,
      organizationId: invite.organizationId,
      role: invite.role,
    });
    if (invite.scopes.length > 0) {
      this.scopes.set(joined.userId, invite.scopes);
      this.roleOverride.set(joined.userId, membershipRoleFor(invite.scopes, invite.role));
    }
    const passwordTokenIssued = await this.issuePasswordSetToken({
      email: invite.email,
      tokenHash: input.passwordTokenHash,
      expiresAt: input.passwordExpiresAt,
      now: input.now,
    });
    return { passwordTokenIssued };
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
        phone: this.details.get(a.userId)?.phone ?? null,
        position: this.details.get(a.userId)?.position ?? null,
        suspended: this.suspended.has(a.userId),
        scopes: this.scopes.get(a.userId) ?? [],
      }));
  }

  /** Телефон и должность по человеку (v2.10) и что ушло в журнал */
  readonly details = new Map<string, { phone: string | null; position: string | null }>();
  readonly detailChanges: Array<{
    organizationId: string;
    userId: string;
    by: string;
    positionBefore: string | null;
    positionAfter: string | null;
    phoneChanged: boolean;
  }> = [];

  async setMemberDetails(input: {
    organizationId: string;
    userId: string;
    phone: string | null;
    position: string | null;
    by: string;
    roles: readonly MembershipRole[] | null;
  }): Promise<MemberWrite> {
    const a = this.accounts.find(
      (x) => x.userId === input.userId && x.organizationId === input.organizationId,
    );
    if (!a) return { outcome: 'missing', role: null };
    const role = this.roleOverride.get(input.userId) ?? a.role;
    if (input.roles && !input.roles.includes(role)) return { outcome: 'role', role };
    const before = this.details.get(input.userId) ?? { phone: null, position: null };
    this.details.set(input.userId, { phone: input.phone, position: input.position });
    this.detailChanges.push({
      organizationId: input.organizationId,
      userId: input.userId,
      by: input.by,
      positionBefore: before.position,
      positionAfter: input.position,
      phoneChanged: before.phone !== input.phone,
    });
    return { outcome: 'done', role };
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

  /** Назначения по бизнесам и филиалам (DATA_MODEL §30.1) и структура организации для тестов */
  readonly scopes = new Map<string, ScopeAssignment[]>();
  readonly scopeWrites: Array<{ userId: string; assignments: ScopeAssignment[]; by: string }> = [];
  structure: OrganizationStructure = {
    businesses: [
      {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Гостиница',
        vertical: 'HOSPITALITY',
        locations: [
          { id: '21111111-1111-4111-8111-111111111111', name: 'Филиал 1' },
          { id: '22222222-2222-4222-8222-222222222222', name: 'Филиал 2' },
        ],
      },
      {
        id: '33333333-3333-4333-8333-333333333333',
        name: 'Салон',
        vertical: 'BEAUTY',
        locations: [{ id: '44444444-4444-4444-8444-444444444444', name: 'Салон 1' }],
      },
    ],
  };

  async organizationStructure(): Promise<OrganizationStructure> {
    return this.structure;
  }

  async replaceMemberScopes(input: {
    organizationId: string;
    userId: string;
    assignments: ScopeAssignment[];
    by: string;
    roles: readonly MembershipRole[];
  }): Promise<MemberWrite> {
    const a = this.accounts.find(
      (x) => x.userId === input.userId && x.organizationId === input.organizationId,
    );
    if (!a) return { outcome: 'missing', role: null };
    const role = this.roleOverride.get(input.userId) ?? a.role;
    if (!input.roles.includes(role)) return { outcome: 'role', role };
    if (input.assignments.length > 0) {
      this.scopes.set(input.userId, input.assignments);
      this.roleOverride.set(input.userId, membershipRoleFor(input.assignments, role));
    } else this.scopes.delete(input.userId);
    this.scopeWrites.push({ userId: input.userId, assignments: input.assignments, by: input.by });
    return { outcome: 'done', role };
  }

  /** Приостановленные (DATA_MODEL §30.2) и журнал приостановок для тестов */
  readonly suspended = new Set<string>();
  readonly suspensions: Array<{ userId: string; suspended: boolean; by: string }> = [];

  async setMemberSuspended(input: {
    organizationId: string;
    userId: string;
    suspended: boolean;
    by: string;
    roles: readonly MembershipRole[];
  }): Promise<MemberWrite> {
    const a = this.accounts.find(
      (x) => x.userId === input.userId && x.organizationId === input.organizationId,
    );
    if (!a) return { outcome: 'missing', role: null };
    const role = this.roleOverride.get(input.userId) ?? a.role;
    if (!input.roles.includes(role)) return { outcome: 'role', role };
    if (input.suspended) {
      this.suspended.add(input.userId);
      for (const s of this.sessions) if (s.userId === input.userId) s.revokedAt = new Date();
    } else this.suspended.delete(input.userId);
    this.suspensions.push({ userId: input.userId, suspended: input.suspended, by: input.by });
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
    firstName: i.firstName,
    lastName: i.lastName,
    phone: i.phone,
    position: i.position,
    scopes: i.scopes,
  };
}
