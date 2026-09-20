import 'reflect-metadata';
import { randomInt } from 'node:crypto';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  CODE_LENGTH,
  CODE_REJECTED_MESSAGE,
  INVITE_TTL_MS,
  MAX_CODES_PER_EMAIL_PER_HOUR,
  MAX_CODES_PER_IP_PER_HOUR,
  checkCode,
  checkInvite,
  checkSession,
  describeUserAgent,
  expiresAt as codeExpiresAt,
  formatCode,
  hashSessionToken,
  inviteExpiresAt,
  isCodeShaped,
  isEmailShaped,
  normalizeEmail,
  sessionExpiresAt,
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

const HOUR_MS = 60 * 60 * 1000;
const CODE_TTL_MS_FOR_LETTER = 10 * 60 * 1000;

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
}

export type InviteOutcome =
  { ok: true; invite: InviteView } | { ok: false; reason: 'email' | 'member' };

/** Кого пустили внутрь. Ровно то, что экран показывает вошедшему. */
export interface Session {
  email: string;
  organizationId: string;
  organizationName: string;
  organizationStatus: SessionRecord['organizationStatus'];
  trialEndsAt: Date | null;
}

export interface VerifyResult {
  token: string;
  session: Session;
}

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

  /**
   * Запрос кода. Наружу эта операция всегда выглядит одинаково: неважно, есть такой адрес,
   * нет его, или человек долбится в лимит. Иначе форма входа превращается в справочник —
   * перебором выясняется, кто наши клиенты. Поэтому здесь нет ни одного `throw`.
   */
  async requestCode(rawEmail: unknown, ip: string | null): Promise<void> {
    if (typeof rawEmail !== 'string') return;
    const email = normalizeEmail(rawEmail);
    if (!isEmailShaped(email)) return;
    if (await this.overLimit(email, ip)) return;

    // Незнакомому адресу код не шлём и в базе не заводим — иначе таблица кодов растёт от перебора.
    // Наружу разницы всё равно нет: ответ тот же самый.
    if ((await this.repo.accountByEmail(email)) === null) return;
    await this.issueCode(email, ip);
  }

  // Регистрация из этого пути снята 20.09.2026: владелец выбрал вход по паролю (ADR-053), и
  // /auth/register теперь заводит организацию с паролем сразу (AuthService.register), без письма.
  // Запрос кода и проверка кода ниже остаются: по ним всё ещё входят те, у кого код на руках.

  private async overLimit(email: string, ip: string | null): Promise<boolean> {
    const since = new Date(Date.now() - HOUR_MS);
    if ((await this.repo.codesForEmailSince(email, since)) >= MAX_CODES_PER_EMAIL_PER_HOUR) {
      this.log.warn(
        `код не выслан: предел на адрес исчерпан (${MAX_CODES_PER_EMAIL_PER_HOUR}/час)`,
      );
      return true;
    }
    if (ip && (await this.repo.codesForIpSince(ip, since)) >= MAX_CODES_PER_IP_PER_HOUR) {
      this.log.warn(
        `код не выслан: предел на адрес сети исчерпан (${MAX_CODES_PER_IP_PER_HOUR}/час)`,
      );
      return true;
    }
    return false;
  }

  /** Код в базу, письмо человеку. Пределы и существование адреса проверены до вызова. */
  private async issueCode(email: string, ip: string | null): Promise<void> {
    const code = formatCode(randomInt(0, 10 ** CODE_LENGTH));
    const now = new Date();
    await this.repo.saveLoginCode({
      email,
      codeHash: hashSecret(code),
      expiresAt: codeExpiresAt(now),
      ip,
    });

    try {
      if (!this.mailReady) {
        this.log.error('MAIL_* не настроены — код сгенерирован, но письмо не отправлено');
        return;
      }
      await this.sender.send(mail.loginCodeLetter(email, code, CODE_TTL_MS_FOR_LETTER));
    } catch (e) {
      // Письмо не ушло — код в базе останется и протухнет сам. Наружу всё равно молчим.
      this.log.error(`письмо с кодом не отправлено: ${(e as Error).message}`);
    }
  }

  /**
   * Проверка кода. Причина отказа наружу одна на все случаи (CODE_REJECTED_MESSAGE):
   * по тексту нельзя понять, был ли код, протух он, исчерпаны попытки или просто не тот.
   */
  async verify(
    rawEmail: unknown,
    rawCode: unknown,
    userAgent: string | null,
  ): Promise<VerifyResult | null> {
    if (typeof rawEmail !== 'string' || typeof rawCode !== 'string') return null;
    const email = normalizeEmail(rawEmail);
    const code = rawCode.trim();
    if (!isEmailShaped(email) || !isCodeShaped(code)) return null;

    const stored = await this.repo.latestLoginCode(email);
    if (!stored) return null;

    const matches = hashEquals(stored.codeHash, hashSecret(code));
    const now = new Date();
    const verdict = checkCode(stored, matches, now);
    if (!verdict.ok) {
      // Попытку засчитываем только за неугаданный код. Протухший и использованный не тратят
      // попытки: считать их значило бы дать чужому человеку способ погасить чужой код.
      if (verdict.reason === 'mismatch') await this.repo.markCodeAttempt(stored.id);
      return null;
    }

    const account = await this.repo.accountByEmail(email);
    if (!account) return null;

    await this.repo.markCodeUsed(stored.id, now);
    await this.repo.markLogin(account.userId, now);

    const token = newSessionToken();
    await this.repo.createSession({
      tokenHash: hashSecret(token),
      userId: account.userId,
      organizationId: account.organizationId,
      expiresAt: sessionExpiresAt(now),
      userAgent,
    });
    return { token, session: toSession(account) };
  }

  /** Кто вошёл. `null` — сессии нет, она протухла или её отозвали; разницы наружу нет. */
  async whoIs(token: string | null): Promise<Session | null> {
    if (!token) return null;
    const stored = await this.repo.sessionByTokenHash(hashSecret(token));
    if (!stored) return null;
    if (!checkSession(stored, new Date()).ok) return null;
    return toSession(stored);
  }

  /** Автор для журнала действий: внутренний номер человека и организации. Наружу не отдаётся. */
  async actorFor(token: string): Promise<Actor | null> {
    const stored = await this.repo.sessionByTokenHash(hashSecret(token));
    if (!stored) return null;
    if (!checkSession(stored, new Date()).ok) return null;
    return { userId: stored.userId, organizationId: stored.organizationId };
  }

  /**
   * Выход. Не «забыть на клиенте», а отметка в базе: после неё прежний ключ мёртв, даже если
   * кто-то успел его скопировать. Повторный выход по тому же ключу — не ошибка.
   */
  async logout(token: string | null): Promise<void> {
    if (!token) return;
    await this.repo.revokeSession(hashSecret(token), new Date());
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

  /** `null` — сессии нет: список приглашений видит только вошедший, и только своей организации. */
  async pendingInvites(sessionToken: string | null): Promise<InviteView[] | null> {
    const who = await this.liveSession(sessionToken);
    if (!who) return null;
    return (await this.repo.pendingInvites(who.organizationId, new Date())).map(toInviteView);
  }

  /**
   * Отпечатки ключа обоих входов, пока живут оба (Q-146): по коду — HMAC с `SESSION_SECRET`
   * (`hashSecret`), по паролю — SHA-256 (`hashSessionToken`, ADR-049). Приглашения, список «где я
   * вошёл» и «выйти везде» относятся к человеку, а не к способу входа, поэтому свою сессию ищем по обоим —
   * как замок `AuthService.findByToken`, только в обратном порядке.
   */
  private tokenHashes(token: string): string[] {
    return [hashSecret(token), hashSessionToken(token)];
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
  async acceptInvite(rawToken: string, ip: string | null): Promise<InvitePreview | null> {
    const invite = await this.liveInvite(rawToken);
    if (!invite) return null;
    await this.repo.joinOrganization({
      email: invite.email,
      organizationId: invite.organizationId,
    });
    await this.repo.markInviteAccepted(invite.id, new Date());
    if (
      !(await this.overLimit(invite.email, ip)) &&
      (await this.repo.accountByEmail(invite.email))
    ) {
      await this.issueCode(invite.email, ip);
    }
    return {
      organizationName: invite.organizationName,
      email: invite.email,
      expiresAt: invite.expiresAt,
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

function toSession(a: {
  email: string;
  organizationId: string;
  organizationName: string;
  organizationStatus: SessionRecord['organizationStatus'];
  trialEndsAt: Date | null;
}): Session {
  return {
    email: a.email,
    organizationId: a.organizationId,
    organizationName: a.organizationName,
    organizationStatus: a.organizationStatus,
    trialEndsAt: a.trialEndsAt,
  };
}

export { CODE_REJECTED_MESSAGE };
