import 'reflect-metadata';
import { Inject, Injectable, Logger, Optional, ServiceUnavailableException } from '@nestjs/common';
import {
  INVITES_PER_DAY,
  INVITE_TTL_MS,
  MEMBERSHIP_ROLES,
  canInvite,
  canManageStaff,
  canRemoveMember,
  canSetRoleAtDesk,
  checkInvite,
  invitableRoles,
  parseInviteRole,
  type MembershipRole,
  checkSession,
  describeUserAgent,
  hashSessionToken,
  inviteExpiresAt,
  isEmailShaped,
  normalizeEmail,
  resetExpiry,
} from '@pms/domain';
import { hashEquals, hashSecret, newSessionToken } from '@pms/shared';
import { mail } from '@pms/integrations';
import {
  ACCOUNTS_REPOSITORY,
  type AccountsRepository,
  type InviteRecord,
  type SessionRecord,
} from './accounts.repository';
import type { Actor } from './actor';

/** Строка «где я вошёл»: устройство словами и пометка своего сеанса. Ключей и отпечатков нет. */
export interface SessionRow {
  id: string;
  issuedAt: Date;
  expiresAt: Date;
  device: string;
  current: boolean;
}

/** Что видит вошедший в списке приглашений и что получает в ответ на новое. Ключа здесь нет. */
export interface InviteView {
  id: string;
  email: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
  /** С какой ролью войдёт приглашённый (ADR-107) */
  role: MembershipRole;
  /** Может ли этот вошедший его отозвать: тот, кто вправе позвать с этой ролью */
  revocable: boolean;
}

/** Строка списка «Сотрудники» (ADR-107): кто, роль, с какого дня и что с ним может сделать этот вошедший */
export interface MemberView {
  userId: string;
  email: string;
  name: string | null;
  role: MembershipRole;
  joinedAt: Date;
  /** Последний вход в систему: не входил — null (TEAM1, «Был в системе») */
  lastLoginAt: Date | null;
  /** Это вы */
  you: boolean;
  /** Этот вошедший может его отключить */
  removable: boolean;
  /** Этот вошедший может сменить ему роль (между управляющим и администратором) */
  roleEditable: boolean;
}

/** Отказ в действии над сотрудником: сессии нет — `null` у вызова; остальное — здесь */
export type MemberRefusal =
  'staff' | 'missing' | 'self' | 'owner-target' | 'manager-target' | 'role' | 'owner-only';

/** Что видит человек, открывший ссылку: кто зовёт и кого. */
export interface InvitePreview {
  organizationName: string;
  email: string;
  expiresAt: Date;
  /**
   * Появляется только при принятии: одноразовый ключ, по которому приглашённый задаёт себе пароль.
   * `null` — пароль у него уже есть (позвали во вторую организацию), тогда он просто входит им.
   * При просмотре ссылки ключа нет: смотреть можно сколько угодно, выдаётся он один раз.
   */
  setPasswordToken?: string | null;
}

export type InviteOutcome =
  | { ok: true; invite: InviteView }
  | { ok: false; reason: 'email' | 'member' | 'owner' | 'limit' | 'role' | 'manager-role' };

@Injectable()
export class AccountsService {
  private readonly log = new Logger(AccountsService.name);

  constructor(
    @Inject(ACCOUNTS_REPOSITORY) private readonly repo: AccountsRepository,
    @Inject('MAIL_SENDER') private readonly sender: mail.MailSender,
    @Inject('MAIL_CONFIG_PRESENT') private readonly mailReady: boolean,
    /**
     * Адрес стойки для ссылок в письмах (`APP_URL`). Необязателен: модули и тесты, которым
     * приглашения не нужны, его не объявляют — тогда ссылка в письме будет относительной.
     */
    @Optional() @Inject('APP_URL') private readonly appUrl: string = '',
  ) {}

  // Вход по одноразовому коду на почту снят 20.09.2026 (ADR-053, решение владельца по Q-146).
  // Вместе с ним отсюда ушли запрос кода, его выдача, проверка и пределы на перебор: выдавать
  // больше нечего, а маршруты /auth/code и /auth/verify сняты с контроллера. Приглашения теперь
  // ведут к паролю (acceptInvite ниже), регистрация — тоже (AuthService.register).

  /** Автор для журнала действий: внутренний номер человека и организации. Наружу не отдаётся. */
  async actorFor(token: string): Promise<Actor | null> {
    const stored = await this.liveSession(token);
    return stored ? { userId: stored.userId, organizationId: stored.organizationId } : null;
  }

  // ── «Где я вошёл» и «выйти везде» (§3 п. 3 плана, DATA_MODEL §13.5) ─────────────────────────

  /** Живые сессии человека, своя помечена. `null` — сессии нет. Ключей и отпечатков наружу нет. */
  async sessions(token: string | null): Promise<SessionRow[] | null> {
    const who = await this.liveSession(token);
    if (!who || !token) return null;
    const own = this.tokenHashes(token);
    const rows = await this.repo.sessionsForUser(who.userId, new Date());
    return rows.map((s) => ({
      id: s.id,
      issuedAt: s.issuedAt,
      expiresAt: s.expiresAt,
      device: describeUserAgent(s.userAgent),
      current: own.some((hash) => hashEquals(s.tokenHash, hash)),
    }));
  }

  /**
   * «Выйти везде»: отзыв всех сессий человека, включая эту. Без сессии — пустое действие, как
   * обычный выход: повтор с мёртвым ключом не ошибка.
   */
  async logoutEverywhere(token: string | null): Promise<number> {
    const who = await this.liveSession(token);
    if (!who) return 0;
    return this.repo.revokeAllSessions(who.userId, new Date());
  }

  // ── Приглашения (этап 7, DATA_MODEL §13.6) ──────────────────────────────────────────────────

  /**
   * Пригласить по почте. Кто зовёт — известен (сессия проверена контроллером), поэтому здесь, в
   * отличие от входа, ошибки формы наружу называются: не почта, уже в организации. Ключ ссылки
   * уходит только в письмо; в базе — отпечаток.
   */
  async createInvite(
    sessionToken: string | null,
    rawEmail: unknown,
    rawRole?: unknown,
  ): Promise<InviteOutcome | null> {
    const who = await this.liveSession(sessionToken);
    if (!who) return null;
    // приглашают владелец и управляющий (DATA_MODEL §16.5, ADR-107); ярлык 'owner' — отказ «не ваше»
    if (!canManageStaff(who.role)) return { ok: false, reason: 'owner' };
    // без роли — администратор, как принимались приглашения до ADR-107; владельца приглашением не назначают
    const role =
      rawRole === undefined || rawRole === null || rawRole === ''
        ? 'STAFF'
        : parseInviteRole(rawRole);
    if (!role) return { ok: false, reason: 'role' };
    if (!canInvite(who.role, role)) return { ok: false, reason: 'manager-role' };
    if (typeof rawEmail !== 'string') return { ok: false, reason: 'email' };
    const email = normalizeEmail(rawEmail);
    if (!isEmailShaped(email)) return { ok: false, reason: 'email' };
    if (await this.repo.isMember(email, who.organizationId)) return { ok: false, reason: 'member' };

    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 3_600_000);
    if ((await this.repo.invitesCreatedSince(who.organizationId, dayAgo)) >= INVITES_PER_DAY)
      return { ok: false, reason: 'limit' };

    const token = newSessionToken();
    const invite = await this.repo.createInvite({
      organizationId: who.organizationId,
      email,
      tokenHash: hashSecret(token),
      expiresAt: inviteExpiresAt(now),
      createdBy: who.userId,
      role,
    });
    const link = `${this.appUrl.replace(/\/+$/, '')}/invite/${token}`;
    try {
      if (!this.mailReady) throw new Error('Mail is not configured');
      await this.sender.send(
        mail.inviteLetter(email, who.organizationName, link, INVITE_TTL_MS, MEMBERSHIP_ROLES[role]),
      );
    } catch {
      // A possibly delivered link must not grant access after a reported delivery failure.
      await this.repo.revokeInvite(
        invite.id,
        who.organizationId,
        new Date(),
        invitableRoles(who.role),
      );
      this.log.error('Не удалось отправить приглашение; ссылка отозвана');
      throw new ServiceUnavailableException(
        'Не удалось отправить письмо. Приглашение отозвано. Проверьте настройку почты и попробуйте снова.',
      );
    }
    return { ok: true, invite: toInviteView(invite, who.role) };
  }

  /**
   * Отозвать приглашение (аудит 26.09, С-10): опечатка в адресе иначе оставляла постороннему ссылку на 7 суток.
   * `null` — сессии нет; `'owner'` — отзывает только владелец; `'missing'` — живого приглашения с таким id у этой
   * организации нет (чужое — тоже «нет», без подробностей).
   */
  async revokeInvite(
    sessionToken: string | null,
    id: string,
  ): Promise<'ok' | 'owner' | 'missing' | null> {
    const who = await this.liveSession(sessionToken);
    if (!who) return null;
    if (!canManageStaff(who.role)) return 'owner';
    // отзывает тот, кто вправе позвать с этой ролью: приглашение управляющего управляющему «не найдено»
    const allowed = invitableRoles(who.role);
    return (await this.repo.revokeInvite(id, who.organizationId, new Date(), allowed))
      ? 'ok'
      : 'missing';
  }

  /**
   * `null` — сессии нет: список приглашений видит только вошедший, и только своей организации; `'owner'` — вошедший не
   * владелец (DATA_MODEL §16.1): приглашениями распоряжается владелец.
   */
  async pendingInvites(sessionToken: string | null): Promise<InviteView[] | 'owner' | null> {
    const who = await this.liveSession(sessionToken);
    if (!who) return null;
    if (!canManageStaff(who.role)) return 'owner';
    return (await this.repo.pendingInvites(who.organizationId, new Date())).map((i) =>
      toInviteView(i, who.role),
    );
  }

  // ── Сотрудники (ADR-107, DATA_MODEL §16.1 v1.14) ────────────────────────────────────────────

  /** Люди своей организации с ролями. `null` — сессии нет; `'staff'` — вошедшему сотрудники не открыты */
  async members(sessionToken: string | null): Promise<MemberView[] | 'staff' | null> {
    const who = await this.liveSession(sessionToken);
    if (!who) return null;
    if (!canManageStaff(who.role)) return 'staff';
    return (await this.repo.members(who.organizationId)).map((m) => {
      const you = m.userId === who.userId;
      return {
        ...m,
        you,
        removable: !you && canRemoveMember(who.role, m.role),
        roleEditable:
          !you && canSetRoleAtDesk(who.role, m.role, m.role === 'STAFF' ? 'MANAGER' : 'STAFF'),
      };
    });
  }

  /**
   * Отключить сотрудника: владелец — управляющих и администраторов, управляющий — администраторов; себя и владельца — нет.
   * Членство удаляется, сессии этой организации гаснут на следующем запросе.
   */
  async removeMember(
    sessionToken: string | null,
    userId: string,
  ): Promise<'ok' | MemberRefusal | null> {
    const who = await this.liveSession(sessionToken);
    if (!who) return null;
    if (!canManageStaff(who.role)) return 'staff';
    const target = (await this.repo.members(who.organizationId)).find((m) => m.userId === userId);
    if (!target) return 'missing';
    if (target.userId === who.userId) return 'self';
    if (target.role === 'OWNER') return 'owner-target';
    if (!canRemoveMember(who.role, target.role)) return 'manager-target';
    // роль сверяется ещё раз в момент записи: пока шла проверка, владелец мог повысить человека
    const write = await this.repo.removeMember({
      organizationId: who.organizationId,
      userId,
      by: who.userId,
      roles: invitableRoles(who.role),
    });
    if (write.outcome === 'missing') return 'missing';
    if (write.outcome === 'role') return write.role === 'OWNER' ? 'owner-target' : 'manager-target';
    return 'ok';
  }

  /** Сменить роль между управляющим и администратором — только владелец; владельца назначает команда на сервере */
  async setMemberRole(
    sessionToken: string | null,
    userId: string,
    rawRole: unknown,
  ): Promise<
    | { ok: true; member: { userId: string; role: MembershipRole } }
    | { ok: false; reason: MemberRefusal }
    | null
  > {
    const who = await this.liveSession(sessionToken);
    if (!who) return null;
    if (!canManageStaff(who.role)) return { ok: false, reason: 'staff' };
    if (!canSetRoleAtDesk(who.role, 'STAFF', 'MANAGER')) return { ok: false, reason: 'owner-only' };
    const role = parseInviteRole(rawRole);
    if (!role) return { ok: false, reason: 'role' };
    const target = (await this.repo.members(who.organizationId)).find((m) => m.userId === userId);
    if (!target) return { ok: false, reason: 'missing' };
    if (target.userId === who.userId) return { ok: false, reason: 'self' };
    if (!canSetRoleAtDesk(who.role, target.role, role))
      return { ok: false, reason: 'owner-target' };
    // владельца так не задеть: роль меняется, только если в момент записи она управляющий или администратор
    const write = await this.repo.setMemberRole({
      organizationId: who.organizationId,
      userId,
      role,
      by: who.userId,
      from: ['MANAGER', 'STAFF'],
    });
    if (write.outcome === 'missing') return { ok: false, reason: 'missing' };
    if (write.outcome === 'role') return { ok: false, reason: 'owner-target' };
    return { ok: true, member: { userId, role } };
  }

  /**
   * Отпечаток ключа сессии — SHA-256 (`hashSessionToken`, ADR-049). До 20.09.2026 рядом жил второй,
   * HMAC с `SESSION_SECRET`: им помечались сессии входа по коду. Вход по коду снят, новых таких
   * сессий не появляется, и искать по второму отпечатку больше нечего.
   */
  private tokenHashes(token: string): string[] {
    return [hashSessionToken(token)];
  }

  /**
   * Живая сессия целиком: автор для `created_by` и организация для письма. Наружу не отдаётся. Проверяется так же полно,
   * как при входе (`AuthService`): срок и отзыв, приостановленная организация (аудит 26.09, С-4), заблокированный человек,
   * снятое членство (С-10). Замок входа читает заголовки, а этот контроллер — сначала куку: без этих проверок по куке
   * действовала бы сессия, которую замок не видел.
   */
  private async liveSession(token: string | null): Promise<SessionRecord | null> {
    if (!token) return null;
    for (const hash of this.tokenHashes(token)) {
      const stored = await this.repo.sessionByTokenHash(hash);
      if (!stored) continue;
      if (!checkSession(stored, new Date()).ok) return null;
      if (
        stored.organizationStatus === 'SUSPENDED' ||
        stored.userStatus !== 'ACTIVE' ||
        !stored.member
      )
        return null;
      return stored;
    }
    return null;
  }

  /** Кто зовёт и кого — для страницы по ссылке. `null` на любую мёртвую ссылку, без подробностей. */
  async inviteByToken(rawToken: string): Promise<InvitePreview | null> {
    const invite = await this.liveInvite(rawToken);
    return invite
      ? {
          organizationName: invite.organizationName,
          email: invite.email,
          expiresAt: invite.expiresAt,
        }
      : null;
  }

  /**
   * Принять: человек и членство заводятся (или уже есть), приглашение гасится, на почту уходит
   * обычный код для входа. Ссылка сессией не становится — вход остаётся одним путём.
   * Код не уходит, если адрес исчерпал часовой предел: членство всё равно заведено, код можно
   * запросить с формы входа.
   */
  async acceptInvite(rawToken: string): Promise<InvitePreview | null> {
    const invite = await this.liveInvite(rawToken);
    if (!invite) return null;
    await this.repo.joinOrganization({
      email: invite.email,
      organizationId: invite.organizationId,
      role: invite.role,
    });
    const now = new Date();
    await this.repo.markInviteAccepted(invite.id, now);
    // Раньше здесь уходил код на почту. С 20.09.2026 вход один — по паролю (ADR-053), и код с экрана
    // снят; вдобавок письмо требует настроенной почтовой службы, а её может не быть. Поэтому выдаём
    // одноразовую ссылку «задайте пароль» прямо в ответ: сама ссылка-приглашение и есть доказательство,
    // что перед нами приглашённый, — второго такого же секрета в письме не нужно.
    const token = newSessionToken();
    const issued = await this.repo.issuePasswordSetToken({
      email: invite.email,
      tokenHash: hashSessionToken(token),
      expiresAt: resetExpiry(now),
      now,
    });
    return {
      organizationName: invite.organizationName,
      email: invite.email,
      expiresAt: invite.expiresAt,
      // null — пароль у человека уже есть: он просто входит им, задавать заново нечего
      setPasswordToken: issued ? token : null,
    };
  }

  private async liveInvite(rawToken: string): Promise<InviteRecord | null> {
    const token = rawToken.trim();
    if (!token) return null;
    const invite = await this.repo.inviteByTokenHash(hashSecret(token));
    if (!invite) return null;
    return checkInvite(invite, new Date()).ok ? invite : null;
  }
}

function toInviteView(i: InviteRecord, actor: MembershipRole): InviteView {
  return {
    id: i.id,
    email: i.email,
    expiresAt: i.expiresAt,
    acceptedAt: i.acceptedAt,
    createdAt: i.createdAt,
    role: i.role,
    revocable: canInvite(actor, i.role),
  };
}
