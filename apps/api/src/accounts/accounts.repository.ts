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

/** Строка списка «где я вошёл» (§13.5). Отпечаток нужен только чтобы отметить свой сеанс; наружу не едет. */
export interface SessionListRecord {
  id: string;
  tokenHash: string;
  issuedAt: Date;
  expiresAt: Date;
  userAgent: string | null;
}

/** Приглашение как оно лежит в базе (DATA_MODEL §13.6): ключа нет, только отпечаток. */
export interface InviteRecord {
  id: string;
  organizationId: string;
  organizationName: string;
  email: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
}

export interface AccountsRepository {
  // Коды на почту (пределы, выдача, проверка) сняты 20.09.2026 вместе со входом по коду (ADR-053).
  // Там же снят createSession: сессии заводит только AuthService, а читать их отсюда по-прежнему нужно.

  accountByEmail(email: string): Promise<AccountRecord | null>;
  /**
   * Регистрация: организация, человек и членство одной операцией — либо всё, либо ничего.
   * `null` — адрес уже занят (в том числе заблокированным): гонку двух регистраций на один адрес
   * решает уникальность `users.email`, а не проверка перед вставкой.
   */
  createAccount(input: {
    email: string;
    organizationName: string;
    trialEndsAt: Date;
  }): Promise<AccountRecord | null>;
  markLogin(userId: string, at: Date): Promise<void>;

  sessionByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  revokeSession(tokenHash: string, at: Date): Promise<void>;
  /** Живые сессии человека (не отозванные, не протухшие на `now`), новые сверху — «где я вошёл». */
  sessionsForUser(userId: string, now: Date): Promise<SessionListRecord[]>;
  /** «Выйти везде»: отзыв всех живых строк человека. Возвращает, сколько отозвано. */
  revokeAllSessions(userId: string, at: Date): Promise<number>;

  // ── Приглашения (этап 7, DATA_MODEL §13.6) ──────────────────────────────────────────────────
  createInvite(input: {
    organizationId: string;
    email: string;
    tokenHash: string;
    expiresAt: Date;
    createdBy: string;
  }): Promise<InviteRecord>;
  /** Не принятые и не просроченные на момент `now`, новые сверху. */
  pendingInvites(organizationId: string, now: Date): Promise<InviteRecord[]>;
  inviteByTokenHash(tokenHash: string): Promise<InviteRecord | null>;
  markInviteAccepted(id: string, at: Date): Promise<void>;
  /** Есть ли у адреса членство в этой организации (любой статус человека). */
  isMember(email: string, organizationId: string): Promise<boolean>;
  /**
   * Вступление по приглашению: человек заводится, если его нет; членство — если его нет. Повторный
   * вызов ничего не дублирует (составной ключ `memberships`). Возвращает учётку в этой организации.
   */
  joinOrganization(input: { email: string; organizationId: string }): Promise<AccountRecord>;
  /**
   * Одноразовая ссылка «задайте пароль» для только что вступившего (ADR-053). Раньше принятие
   * приглашения слало код на почту — но вход по коду с экрана снят, а почта может быть не настроена.
   * Прежние неиспользованные ссылки этого человека гасятся: живой остаётся одна.
   *
   * `false` — ссылку не выдаём: человека нет, он заблокирован или пароль у него уже есть. Во втором
   * случае звать его задавать пароль заново нельзя: это был бы сброс пароля по чужому приглашению.
   */
  issuePasswordSetToken(input: {
    email: string;
    tokenHash: string;
    expiresAt: Date;
    now: Date;
  }): Promise<boolean>;
}

export const ACCOUNTS_REPOSITORY = Symbol('ACCOUNTS_REPOSITORY');
