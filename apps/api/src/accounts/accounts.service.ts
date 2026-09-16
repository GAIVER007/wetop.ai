import 'reflect-metadata';
import { randomInt } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  CODE_LENGTH,
  CODE_REJECTED_MESSAGE,
  MAX_CODES_PER_EMAIL_PER_HOUR,
  MAX_CODES_PER_IP_PER_HOUR,
  checkCode,
  checkSession,
  expiresAt as codeExpiresAt,
  formatCode,
  isCodeShaped,
  isEmailShaped,
  normalizeEmail,
  normalizeOrganizationName,
  sessionExpiresAt,
  trialEndsAt,
} from '@pms/domain';
import { hashEquals, hashSecret, newSessionToken } from '@pms/shared';
import { mail } from '@pms/integrations';
import { ACCOUNTS_REPOSITORY, type AccountsRepository, type SessionRecord } from './accounts.repository';

const HOUR_MS = 60 * 60 * 1000;
const CODE_TTL_MS_FOR_LETTER = 10 * 60 * 1000;

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

  /**
   * Регистрация. Форма ввода уже проверена контроллером; здесь, как и в `requestCode`, ни одного
   * `throw`: занятый адрес, новый адрес, исчерпанный предел — наружу всё одно и то же.
   * Пределы проверяются до создания организации: иначе перебором адресов заводятся тысячи
   * пустых организаций. Занятому адресу новая организация не заводится — уходит код в его старую.
   */
  async register(rawEmail: string, rawOrganizationName: string, ip: string | null): Promise<void> {
    const email = normalizeEmail(rawEmail);
    const organizationName = normalizeOrganizationName(rawOrganizationName);
    if (!isEmailShaped(email) || !organizationName) return;
    if (await this.overLimit(email, ip)) return;

    let account = await this.repo.accountByEmail(email);
    if (account === null) {
      const now = new Date();
      account = await this.repo.createAccount({ email, organizationName, trialEndsAt: trialEndsAt(now) });
      if (account === null) {
        // Адрес занят, но `accountByEmail` его не отдал: человек заблокирован или без организации.
        // Такому код не шлём, наружу молчим — как и при обычном запросе кода.
        return;
      }
      this.log.log(`зарегистрирована организация ${account.organizationId}, пробный период до ${account.trialEndsAt?.toISOString()}`);
    }
    await this.issueCode(email, ip);
  }

  private async overLimit(email: string, ip: string | null): Promise<boolean> {
    const since = new Date(Date.now() - HOUR_MS);
    if ((await this.repo.codesForEmailSince(email, since)) >= MAX_CODES_PER_EMAIL_PER_HOUR) {
      this.log.warn(`код не выслан: предел на адрес исчерпан (${MAX_CODES_PER_EMAIL_PER_HOUR}/час)`);
      return true;
    }
    if (ip && (await this.repo.codesForIpSince(ip, since)) >= MAX_CODES_PER_IP_PER_HOUR) {
      this.log.warn(`код не выслан: предел на адрес сети исчерпан (${MAX_CODES_PER_IP_PER_HOUR}/час)`);
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

  /**
   * Выход. Не «забыть на клиенте», а отметка в базе: после неё прежний ключ мёртв, даже если
   * кто-то успел его скопировать. Повторный выход по тому же ключу — не ошибка.
   */
  async logout(token: string | null): Promise<void> {
    if (!token) return;
    await this.repo.revokeSession(hashSecret(token), new Date());
  }
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
