/**
 * Хранилище учётных записей в памяти — для тестов контроллера. В общий индекс модуля не входит.
 * Ведёт себя как настоящее в том, что важно проверкам: считает коды за час, помнит попытки,
 * гасит использованный код, отзывает сессии.
 */
import type {
  AccountRecord,
  AccountsRepository,
  LoginCodeRecord,
  SessionRecord,
} from './accounts.repository';

export const ACCOUNT: AccountRecord = {
  userId: 'u-1',
  email: 'urij@example.com',
  organizationId: 'org-1',
  organizationName: 'Хостел «Пример»',
  organizationStatus: 'TRIAL',
  trialEndsAt: new Date('2026-09-23T12:00:00.000Z'),
};

interface StoredCode extends LoginCodeRecord {
  email: string;
  ip: string | null;
  createdAt: Date;
}
interface StoredSession {
  tokenHash: string;
  userId: string;
  organizationId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  userAgent: string | null;
}

export class FakeAccountsRepository implements AccountsRepository {
  readonly codes: StoredCode[] = [];
  readonly sessions: StoredSession[] = [];
  readonly logins: Array<{ userId: string; at: Date }> = [];
  accounts: AccountRecord[] = [ACCOUNT];
  private seq = 0;

  async codesForEmailSince(email: string, since: Date): Promise<number> {
    return this.codes.filter((c) => c.email === email && c.createdAt >= since).length;
  }

  async codesForIpSince(ip: string, since: Date): Promise<number> {
    return this.codes.filter((c) => c.ip === ip && c.createdAt >= since).length;
  }

  async saveLoginCode(input: {
    email: string;
    codeHash: string;
    expiresAt: Date;
    ip: string | null;
  }): Promise<void> {
    this.seq += 1;
    this.codes.push({
      id: `c-${this.seq}`,
      email: input.email,
      codeHash: input.codeHash,
      expiresAt: input.expiresAt,
      ip: input.ip,
      attempts: 0,
      usedAt: null,
      createdAt: new Date(),
    });
  }

  async latestLoginCode(email: string): Promise<LoginCodeRecord | null> {
    const own = this.codes.filter((c) => c.email === email);
    return own.length ? (own[own.length - 1] as LoginCodeRecord) : null;
  }

  async markCodeAttempt(id: string): Promise<void> {
    const c = this.codes.find((x) => x.id === id);
    if (c) c.attempts += 1;
  }

  async markCodeUsed(id: string, at: Date): Promise<void> {
    const c = this.codes.find((x) => x.id === id);
    if (c) c.usedAt = at;
  }

  async accountByEmail(email: string): Promise<AccountRecord | null> {
    return this.accounts.find((a) => a.email === email) ?? null;
  }

  async markLogin(userId: string, at: Date): Promise<void> {
    this.logins.push({ userId, at });
  }

  async createSession(input: {
    tokenHash: string;
    userId: string;
    organizationId: string;
    expiresAt: Date;
    userAgent: string | null;
  }): Promise<void> {
    this.sessions.push({ ...input, revokedAt: null });
  }

  async sessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const s = this.sessions.find((x) => x.tokenHash === tokenHash);
    if (!s) return null;
    const a = this.accounts.find((x) => x.userId === s.userId);
    if (!a) return null;
    return {
      userId: a.userId,
      email: a.email,
      organizationId: a.organizationId,
      organizationName: a.organizationName,
      organizationStatus: a.organizationStatus,
      trialEndsAt: a.trialEndsAt,
      expiresAt: s.expiresAt,
      revokedAt: s.revokedAt,
    };
  }

  async revokeSession(tokenHash: string, at: Date): Promise<void> {
    const s = this.sessions.find((x) => x.tokenHash === tokenHash);
    if (s && s.revokedAt === null) s.revokedAt = at;
  }
}
