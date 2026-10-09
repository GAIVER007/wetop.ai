import type {
  MembershipRole,
  OrganizationStatus,
  ScopeAssignment,
  UserStatus,
} from '@pms/domain';

/** Пользователь и его организация — всё, что нужно для выдачи сессии (DATA_MODEL §13). */
export interface AccountRecord {
  userId: string;
  email: string;
  organizationId: string;
  organizationName: string;
  organizationStatus: OrganizationStatus;
  trialEndsAt: Date | null;
  /** Роль в этой организации (DATA_MODEL §16.1) */
  role: MembershipRole;
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
  /** Роль человека в организации сессии (DATA_MODEL §16.1); членства нет — `STAFF`, но тогда `member: false` */
  role: MembershipRole;
  /** Человек заблокирован — сессия не действует, как и при входе (§13.2) */
  userStatus: UserStatus;
  /** Есть ли ещё членство в организации сессии: отключённого сотрудника сессия не пускает (аудит 26.09, С-10) */
  member: boolean;
}

/** Итог записи о сотруднике: роль проверяется в момент записи, под блокировкой строки (ADR-107) */
export interface MemberWrite {
  outcome: 'done' | 'missing' | 'role';
  /** Роль в базе на момент записи; `null` — членства нет */
  role: MembershipRole | null;
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
  /** С какой ролью войдёт приглашённый (§13.6 v1.14, ADR-107): `MANAGER` или `STAFF` */
  role: MembershipRole;
  /** Что указал пригласивший (DATA_MODEL §30.3, Q-290): имя, фамилия, телефон +E.164, должность; не указано: null */
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  position: string | null;
  /** Назначения (§30.1); пусто: вся организация */
  scopes: ScopeAssignment[];
}

/** Бизнесы и филиалы организации для назначений (DATA_MODEL §30.1): только действующие */
export interface OrganizationStructure {
  businesses: Array<{
    id: string;
    name: string;
    vertical: string;
    locations: Array<{ id: string; name: string }>;
  }>;
}

/** Человек организации для списка «Сотрудники» (§16.1 v1.14): кто, с какой ролью и с какого дня */
export interface MemberRecord {
  userId: string;
  email: string;
  name: string | null;
  role: MembershipRole;
  joinedAt: Date;
  /** Последний вход в систему (`users.last_login_at`, TEAM1): не входил — null */
  lastLoginAt: Date | null;
  /** Рабочий телефон и должность в этой организации (`memberships`, v2.10, Q-244): не указаны: null */
  phone: string | null;
  position: string | null;
  /** Назначения по бизнесам и филиалам (DATA_MODEL §30.1); пусто: вся организация */
  scopes: ScopeAssignment[];
  /** Приостановлен ли доступ (DATA_MODEL §30.2, Q-289): приостановленный не входит и сессии не пускают */
  suspended: boolean;
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
    role: MembershipRole;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    position?: string | null;
    scopes?: ScopeAssignment[];
  }): Promise<InviteRecord>;
  /** Не принятые и не просроченные на момент `now`, новые сверху. */
  pendingInvites(organizationId: string, now: Date): Promise<InviteRecord[]>;
  inviteByTokenHash(tokenHash: string): Promise<InviteRecord | null>;
  markInviteAccepted(id: string, at: Date): Promise<void>;
  /** Принятие, членство, ссылка на пароль и аудит одной транзакцией. */
  acceptInvite(input: {
    id: string;
    now: Date;
    passwordTokenHash: string;
    passwordExpiresAt: Date;
  }): Promise<{ passwordTokenIssued: boolean } | null>;
  /** Сколько приглашений организация создала с `since` — для суточного предела (аудит 26.09, С-11). */
  invitesCreatedSince(organizationId: string, since: Date): Promise<number>;
  /**
   * Отозвать живое приглашение своей организации: срок истекает сейчас, ссылка больше не открывается (аудит 26.09,
   * С-10). `false` — такого живого приглашения у этой организации нет или его роль не из `roles` (ADR-107: отзывает тот,
   * кто вправе позвать с этой ролью).
   */
  revokeInvite(
    id: string,
    organizationId: string,
    at: Date,
    roles: readonly MembershipRole[],
    by?: string,
    deliveryFailed?: boolean,
  ): Promise<boolean>;
  /** Есть ли у адреса членство в этой организации (любой статус человека). */
  isMember(email: string, organizationId: string): Promise<boolean>;
  /**
   * Вступление по приглашению: человек заводится, если его нет; членство — если его нет. Повторный
   * вызов ничего не дублирует (составной ключ `memberships`). Возвращает учётку в этой организации. Роль — из
   * приглашения (ADR-107); уже состоящему роль не меняется.
   */
  joinOrganization(input: {
    email: string;
    organizationId: string;
    role: MembershipRole;
  }): Promise<AccountRecord>;
  /** Люди организации: владельцы, управляющие, администраторы; внутри роли — по дате вступления */
  members(organizationId: string): Promise<MemberRecord[]>;
  /**
   * Отключить (ADR-107, §16.1 v1.14): удалить членство и записать в журнал организации (`membership.removed`) одной
   * транзакцией. Роль сверяется с `roles` под блокировкой строки: пока шла проверка, владелец мог повысить человека.
   * Сессии этой организации гаснут сами — сессия живёт, пока есть членство. Повторное удаление — `missing`, не сбой.
   */
  removeMember(input: {
    organizationId: string;
    userId: string;
    by: string;
    roles: readonly MembershipRole[];
  }): Promise<MemberWrite>;
  /**
   * Сменить роль и записать в журнал организации (`membership.role.updated`: было, стало) одной транзакцией. Меняется
   * только роль из `from` — сверка под блокировкой строки, владельца так не задеть.
   */
  setMemberRole(input: {
    organizationId: string;
    userId: string;
    role: MembershipRole;
    by: string;
    from: readonly MembershipRole[];
  }): Promise<MemberWrite>;
  /**
   * Телефон и должность (v2.10, Q-244) и запись в журнал организации (`membership.details.updated`: должность было и
   * стало, телефон только отметкой: номер в журнал не пишется) одной транзакцией. `roles`: чьи контакты можно
   * менять, сверка под блокировкой строки, как у отключения; `null`: человек правит себя.
   */
  setMemberDetails(input: {
    organizationId: string;
    userId: string;
    phone: string | null;
    position: string | null;
    by: string;
    roles: readonly MembershipRole[] | null;
  }): Promise<MemberWrite>;
  /** Действующие бизнесы и филиалы организации: из чего выбирают область доступа */
  organizationStructure(organizationId: string): Promise<OrganizationStructure>;
  /**
   * Заменить назначения человека одним списком (DATA_MODEL §30.1) и записать в журнал организации
   * (`membership.scope.updated`: было, стало) одной транзакцией. Пустой список возвращает работу на всю организацию.
   * `memberships.role` ставится по старшей из назначенных ролей; при пустом списке роль остаётся. Роль человека
   * сверяется с `roles` под блокировкой строки.
   */
  replaceMemberScopes(input: {
    organizationId: string;
    userId: string;
    assignments: ScopeAssignment[];
    by: string;
    roles: readonly MembershipRole[];
  }): Promise<MemberWrite>;
  /**
   * Приостановить или возобновить доступ (DATA_MODEL §30.2) и записать в журнал организации (`membership.suspended`,
   * `membership.resumed`) одной транзакцией; при приостановке сессии человека в этой организации отзываются. Роль
   * сверяется с `roles` под блокировкой строки, как у отключения.
   */
  setMemberSuspended(input: {
    organizationId: string;
    userId: string;
    suspended: boolean;
    by: string;
    roles: readonly MembershipRole[];
  }): Promise<MemberWrite>;
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
