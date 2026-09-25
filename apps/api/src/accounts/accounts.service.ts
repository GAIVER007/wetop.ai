import 'reflect-metadata';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  INVITE_TTL_MS,
  canManageStaff,
  checkInvite,
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
}

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
  { ok: true; invite: InviteView } | { ok: false; reason: 'email' | 'member' | 'owner' };

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
  ): Promise<InviteOutcome | null> {
    const who = await this.liveSession(sessionToken);
    if (!who) return null;
    // приглашает только владелец организации (DATA_MODEL §16.1, ADR-083)
    if (!canManageStaff(who.role)) return { ok: false, reason: 'owner' };
    if (typeof rawEmail !== 'string') return { ok: false, reason: 'email' };
    const email = normalizeEmail(rawEmail);
    if (!isEmailShaped(email)) return { ok: false, reason: 'email' };
    if (await this.repo.isMember(email, who.organizationId)) return { ok: false, reason: 'member' };

    const token = newSessionToken();
    const now = new Date();
    const invite = await this.repo.createInvite({
      organizationId: who.organizationId,
      email,
      tokenHash: hashSecret(token),
      expiresAt: inviteExpiresAt(now),
      createdBy: who.userId,
    });
    const link = `${this.appUrl.replace(/\/+$/, '')}/invite/${token}`;
    try {
      if (!this.mailReady) {
        this.log.error('MAIL_* не настроены — приглашение создано, но письмо не отправлено');
      } else {
        await this.sender.send(mail.inviteLetter(email, who.organizationName, link, INVITE_TTL_MS));
      }
    } catch (e) {
      this.log.error(`письмо с приглашением не отправлено: ${(e as Error).message}`);
    }
    return { ok: true, invite: toInviteView(invite) };
  }

  /**
   * `null` — сессии нет: список приглашений видит только вошедший, и только своей организации; `'owner'` — вошедший не
   * владелец (DATA_MODEL §16.1): приглашениями распоряжается владелец.
   */
  async pendingInvites(sessionToken: string | null): Promise<InviteView[] | 'owner' | null> {
    const who = await this.liveSession(sessionToken);
    if (!who) return null;
    if (!canManageStaff(who.role)) return 'owner';
    return (await this.repo.pendingInvites(who.organizationId, new Date())).map(toInviteView);
  }

  /**
   * Отпечаток ключа сессии — SHA-256 (`hashSessionToken`, ADR-049). До 20.09.2026 рядом жил второй,
   * HMAC с `SESSION_SECRET`: им помечались сессии входа по коду. Вход по коду снят, новых таких
   * сессий не появляется, и искать по второму отпечатку больше нечего.
   */
  private tokenHashes(token: string): string[] {
    return [hashSessionToken(token)];
  }

  /** Живая сессия целиком: автор для `created_by` и организация для письма. Наружу не отдаётся. */
  private async liveSession(token: string | null): Promise<SessionRecord | null> {
    if (!token) return null;
    for (const hash of this.tokenHashes(token)) {
      const stored = await this.repo.sessionByTokenHash(hash);
      if (stored) return checkSession(stored, new Date()).ok ? stored : null;
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

function toInviteView(i: InviteRecord): InviteView {
  return {
    id: i.id,
    email: i.email,
    expiresAt: i.expiresAt,
    acceptedAt: i.acceptedAt,
    createdAt: i.createdAt,
  };
}
