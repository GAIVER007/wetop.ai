import type { OrganizationStatus } from '@pms/domain';

/** Пользователь и его организация — всё, что нужно для выдачи сессии (DATA_MODEL §13). */
export interface AccountRecord {
  userId: string;
  email: string;
  organizationId: string;
  organizationName: string;
  organizationStatus: OrganizationStatus;
  trialEndsAt: Date | null;
}

/** Одноразовый код в том виде, в каком он лежит в базе: сам код здесь не хранится, только отпечаток. */
export interface LoginCodeRecord {
  id: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  usedAt: Date | null;
}

export interface SessionRecord {
  userId: string;
  email: string;
  organizationId: string;
  organizationName: string;
  organizationStatus: OrganizationStatus;
  trialEndsAt: Date | null;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface AccountsRepository {
  /** Сколько кодов запрошено на этот адрес с момента `since`. Для предела 5 в час. */
  codesForEmailSince(email: string, since: Date): Promise<number>;
  /** Сколько кодов запрошено с этого адреса сети. Для предела 20 в час. */
  codesForIpSince(ip: string, since: Date): Promise<number>;
  saveLoginCode(input: {
    email: string;
    codeHash: string;
    expiresAt: Date;
    ip: string | null;
  }): Promise<void>;
  /** Последний непогашенный код для адреса. Старые коды не удаляем — по ним считаются пределы. */
  latestLoginCode(email: string): Promise<LoginCodeRecord | null>;
  markCodeAttempt(id: string): Promise<void>;
  markCodeUsed(id: string, at: Date): Promise<void>;

  accountByEmail(email: string): Promise<AccountRecord | null>;
  markLogin(userId: string, at: Date): Promise<void>;

  createSession(input: {
    tokenHash: string;
    userId: string;
    organizationId: string;
    expiresAt: Date;
    userAgent: string | null;
  }): Promise<void>;
  sessionByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  revokeSession(tokenHash: string, at: Date): Promise<void>;
}

export const ACCOUNTS_REPOSITORY = Symbol('ACCOUNTS_REPOSITORY');
