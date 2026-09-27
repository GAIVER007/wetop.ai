import 'reflect-metadata';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  REGISTRATION_EMAIL_MESSAGE,
  REGISTRATION_NAME_MESSAGE,
  REGISTRATION_PERSON_NAME_MESSAGE,
  REGISTRATION_TAKEN_MESSAGE,
  VERIFY_PENDING_MESSAGE,
  LOCK_MINUTES,
  MAX_FAILED_ATTEMPTS,
  checkPassword,
  decideLogin,
  hashPassword,
  hashSessionToken,
  isOrganizationNameShaped,
  isPersonNameShaped,
  newSessionToken,
  normalizeOrganizationName,
  normalizePersonName,
  trialEndsAt,
  validEmail,
  sessionExpiry,
  sessionState,
  type MembershipRole,
  type UserStatus,
} from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';
import { EmailVerificationService } from './email-verification.service';
import { hashPasswordQueued, verifyPasswordQueued } from './attempt-limits';

/** Что знает о вошедшем весь остальной API. Ни хеша пароля, ни токена здесь нет. */
export interface SignedInUser {
  id: string;
  email: string;
  /** Имя в модели необязательно (§13.2) — тогда человека зовём по почте */
  name: string | null;
  /** Организация, под которой открыта сессия (§13.5) */
  organizationId: string;
  /**
   * Роль в этой организации (DATA_MODEL §16.1): владелец, управляющий или администратор. Роль — готовый набор прав
   * (§16.5, ADR-100); проверяет замок ролей `RoleGuard` по праву маршрута.
   */
  role: MembershipRole;
  /** Главный администратор платформы (§16.2): раздел «Платформа». Данных чужих гостиниц это не открывает */
  platformAdmin: boolean;
}

/** Организация сессии — то, что показывает экран входа: имя, состояние и пробный период (ADR-046, §13.1). */
export interface SignedInOrganization {
  name: string;
  status: string;
  trialEndsAt: string | null;
}

export interface LoginResult {
  token: string;
  expiresAt: string;
  user: SignedInUser;
}

/**
 * Что возвращает регистрация. Сессии здесь нет намеренно: пока почта не подтверждена, входа нет
 * (решение владельца 20.09.2026). Стойке нужен только адрес — чтобы показать «письмо ушло туда-то».
 */
export interface RegisterResult {
  pendingVerification: true;
  email: string;
  name: string;
  /** Письмо ушло. `false` — отправка не настроена: человеку нужен владелец, а не повтор. */
  sent: boolean;
}

/**
 * Отпечаток ключа сессии один — SHA-256 (ADR-049). До 20.09.2026 рядом жил второй, HMAC с
 * `SESSION_SECRET`: им помечались сессии входа по коду на почту. Вход по коду снят (ADR-053),
 * новых таких сессий не появляется, и `SESSION_SECRET` замку больше не нужен.
 */

/**
 * Один и тот же ответ на неверную почту, неверный пароль и запертую учётку: форма входа не рассказывает, кто у нас есть
 * (аудит 26.09, С-6 — ответ «Вход заперт…» раньше выдавал существование почты). Про замок текст говорит сам.
 */
const WRONG = `Неверная почта или пароль. После ${MAX_FAILED_ATTEMPTS} неверных попыток подряд вход запирается на ${LOCK_MINUTES} минут.`;
/** Организацию приостановил владелец WETOP (ADR-046): входа нет ни у кого из неё. Пароль при этом назван верно. */
export const ORGANIZATION_SUSPENDED_MESSAGE =
  'Доступ вашей организации приостановлен. Обратитесь в поддержку WETOP.';
/** Регистрация открыта по решению владельца (ADR-055); 0 явно отключает её. */
export const REGISTRATION_CLOSED_MESSAGE =
  'Самостоятельная регистрация закрыта. Попросите владельца объекта прислать приглашение.';

export function registrationOpen(env: Record<string, string | undefined> = process.env): boolean {
  const setting = env.REGISTRATION_OPEN?.trim();
  return !setting || setting === '1';
}

/** Чтобы неизвестная почта отвечала не быстрее неверного пароля, проверка идёт и в пустую. */
const DECOY_HASH = hashPassword('пароля-нет-такого-пользователя');

/** Проверки и хеши паролей всего процесса — через одну очередь (аудит 26.09, С-5). */
const checkPasswordQueued = verifyPasswordQueued;

/** Роль и отметка главного администратора — к сессии, а не к человеку: роль у каждой организации своя */
interface Access {
  role: MembershipRole;
  platformAdmin: boolean;
}

const visible = (
  user: { id: string; email: string; name: string | null },
  organizationId: string,
  access: Access,
): SignedInUser => ({
  id: user.id,
  email: user.email,
  name: user.name,
  organizationId,
  role: access.role,
  platformAdmin: access.platformAdmin,
});

/**
 * Вход в стойку по логину и паролю (DATA_MODEL §13.8, ADR-049, решение владельца 15.09.2026 по Q-139).
 *
 * Модель учётных записей пришла из ADR-046 (организации, членство, приглашения); способ входа — открытая
 * развилка Q-146: коды на почту в схеме есть, но не реализованы, пароль работает. Сессия всегда открыта под
 * организацией (§13.5): её берём из членства человека.
 *
 * Правила входа живут в домене (`@pms/domain/accounts`), здесь только база и журнал. Пароль не попадает
 * ни в журнал, ни в ответы, ни в текст ошибок; в базе лежит хеш пароля и хеш токена сессии.
 * Cloudflare Access остаётся замком на периметре — этот вход его не отменяет (ADR-045).
 */
@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EmailVerificationService) private readonly verification: EmailVerificationService,
  ) {}

  /**
   * Неудача входа — в самой строке и только условными записями (аудит 25.09 М-3, 26.09 С-6 и проверка исправлений):
   * сброс счёта после истёкшего замка делает одна попытка из пачки, остальные прибавляют; замок ставится, только если
   * его нет или он истёк, — опоздавшая попытка свежий замок не трогает.
   */
  private async countFailure(userId: string, resetCounter: boolean | undefined, now: Date): Promise<void> {
    const reset = resetCounter
      ? await this.prisma.db.user.updateMany({
          where: { id: userId, lockedUntil: { lte: now } },
          data: { failedAttempts: 1, lockedUntil: null },
        })
      : { count: 0 };
    const failedAttempts =
      reset.count > 0
        ? 1
        : (
            await this.prisma.db.user.update({
              where: { id: userId },
              data: { failedAttempts: { increment: 1 } },
              select: { failedAttempts: true },
            })
          ).failedAttempts;
    if (failedAttempts >= MAX_FAILED_ATTEMPTS)
      await this.prisma.db.user.updateMany({
        where: { id: userId, OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }] },
        data: { lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60_000) },
      });
  }

  /** ADR-055: единственный источник настройки для API и стойки, без данных пользователей. */
  registrationOptions(): { registrationEnabled: boolean } {
    return { registrationEnabled: registrationOpen() };
  }

  assertRegistrationOpen(): void {
    if (!this.registrationOptions().registrationEnabled) {
      throw new ForbiddenException(REGISTRATION_CLOSED_MESSAGE);
    }
  }

  async login(
    input: { email: string; password: string; userAgentFamily?: string | null },
    now = new Date(),
  ): Promise<LoginResult> {
    const email = validEmail(input.email);
    const user = email
      ? await this.prisma.db.user.findUnique({
          where: { email },
          include: { memberships: { orderBy: { createdAt: 'asc' }, take: 1 } },
        })
      : null;

    if (!user) {
      await checkPasswordQueued(input.password, DECOY_HASH);
      throw new UnauthorizedException(WRONG);
    }

    const checkable = (u: { status: string; lockedUntil: Date | null }) =>
      u.status === 'ACTIVE' && !(u.lockedUntil !== null && u.lockedUntil > now);
    const hashable = checkable(user) && user.passwordHash !== '';
    // Запертой и заблокированной учётке пароль тоже «проверяется» — в пустую: время ответа то же, что у неверного
    const passwordOk = await checkPasswordQueued(
      input.password,
      hashable ? user.passwordHash : DECOY_HASH,
    );
    // Состояние замка — заново, после очереди: пока попытка ждала, другие могли запереть учётку или уже сбросить счёт.
    // По прочитанному до очереди попытки из очереди проверяли настоящий пароль у запертой учётки, а пачка на истёкшем
    // замке сбрасывала счёт каждой попыткой (проверка исправлений 26.09, к С-6).
    const fresh = await this.prisma.db.user.findUnique({ where: { id: user.id } });
    if (!fresh) throw new UnauthorizedException(WRONG);
    const state = {
      status: fresh.status as UserStatus,
      failedAttempts: fresh.failedAttempts,
      lockedUntil: fresh.lockedUntil,
    };
    const decision = decideLogin({ user: state, passwordOk: hashable && passwordOk, now });

    if (decision.outcome !== 'ok') {
      if (decision.outcome === 'wrong') await this.countFailure(user.id, decision.resetCounter, now);
      throw new UnauthorizedException(WRONG);
    }

    // Почта не подтверждена — вход закрыт (решение владельца 20.09.2026). Ответ отличается от WRONG
    // намеренно: пароль человек уже назвал верно, скрывать от него нечего, а иначе он не поймёт,
    // что делать. Стойка по этому ответу предлагает выслать письмо заново.
    if (user.emailVerifiedAt === null) throw new ForbiddenException(VERIFY_PENDING_MESSAGE);

    // Сессия открывается под организацией: без членства человеку нечего открывать (§13.3, §13.5)
    const organizationId = user.memberships[0]?.organizationId;
    if (!organizationId) throw new UnauthorizedException(WRONG);
    await this.assertOrganizationOpen(organizationId);

    const token = newSessionToken();
    await this.prisma.db.user.update({
      where: { id: user.id },
      data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: now },
    });
    const expiresAt = sessionExpiry(now);
    await this.prisma.db.session.create({
      data: {
        userId: user.id,
        organizationId,
        tokenHash: hashSessionToken(token),
        userAgent: input.userAgentFamily ?? null,
        expiresAt,
      },
    });
    await this.record(user.id, 'user.login', { via: 'password' });

    return {
      token,
      expiresAt: expiresAt.toISOString(),
      user: visible(user, organizationId, await this.access(user.id, organizationId)),
    };
  }

  /**
   * Регистрация организации: почта, имя, пароль (решение владельца 20.09.2026, ADR-053, Q-146).
   *
   * Сессия здесь не открывается: сначала человек подтверждает почту по ссылке из письма (решение
   * владельца 20.09.2026). До 20.09.2026 регистрация входила сразу — так на чужой адрес мог
   * зарегистрироваться кто угодно, а опечатка в своём оставляла учётную запись без сброса пароля.
   *
   * Три строки одной транзакцией: организация, человек, членство. Занятый адрес ловим нарушением
   * уникальности `users.email`, а не проверкой «есть ли такой» перед вставкой: две одновременные
   * регистрации на один адрес иначе завели бы две организации.
   *
   * Занятый адрес называется прямо. Это отличается от входа, где ответ один на все отказы, и разница
   * осознанная: форме регистрации иначе нечего ответить человеку, который уже регистрировался.
   */
  async register(
    input: { email: string; name: string; hotelName: string; password: string },
    now = new Date(),
  ): Promise<RegisterResult> {
    this.assertRegistrationOpen();
    const email = validEmail(input.email);
    if (!email) throw new BadRequestException(REGISTRATION_EMAIL_MESSAGE);
    if (!isPersonNameShaped(input.name)) {
      throw new BadRequestException(REGISTRATION_PERSON_NAME_MESSAGE);
    }
    // Название отеля — это и есть название организации: человек вводит его в форме (SaaS-онбординг,
    // решение владельца 21.09), рабочее пространство больше не зовётся именем человека.
    if (!isOrganizationNameShaped(input.hotelName)) {
      throw new BadRequestException(REGISTRATION_NAME_MESSAGE);
    }
    const strength = checkPassword(input.password);
    if (!strength.ok) throw new BadRequestException(`Пароль не годится: ${strength.reason}`);

    const name = normalizePersonName(input.name);
    const organizationName = normalizeOrganizationName(input.hotelName);
    const passwordHash = await hashPasswordQueued(input.password);
    let created: { userId: string; organizationId: string };
    try {
      created = await this.prisma.db.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: { name: organizationName, status: 'TRIAL', trialEndsAt: trialEndsAt(now) },
          select: { id: true },
        });
        // Объект новой организации создаётся сразу (мультитенантность, решение владельца 21.09):
        // без него вошедший упирался бы в «объект не настроен для вашей организации» на каждом экране.
        // Часы и валюта — казахстанские по умолчанию, реквизиты человек заполнит в настройках.
        await tx.property.create({
          data: {
            organizationId: org.id,
            name: organizationName,
            timezone: 'Asia/Almaty', // tz-allow: значение по умолчанию новой гостиницы, не вычисление времени
            currency: 'KZT',
            checkInTime: '14:00',
            checkOutTime: '12:00',
          },
        });
        const user = await tx.user.create({
          data: { email, name, passwordHash, status: 'ACTIVE', lastLoginAt: now },
          select: { id: true },
        });
        // зарегистрировавший — владелец своей организации (DATA_MODEL §16.1, ADR-083)
        await tx.membership.create({
          data: { userId: user.id, organizationId: org.id, role: 'OWNER' },
        });
        return { userId: user.id, organizationId: org.id };
      });
    } catch (e) {
      if (typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'P2002') {
        throw new BadRequestException(REGISTRATION_TAKEN_MESSAGE);
      }
      throw e;
    }

    await this.record(created.userId, 'user.register', { via: 'password', verified: false });

    const sent = await this.verification.sendFor({ userId: created.userId, email, name }, now);
    return { pendingVerification: true, email, name, sent };
  }

  /**
   * Открыть сессию человеку, который только что подтвердил почту. Отдельный вход: пароль здесь
   * уже не спрашиваем — его назвали при регистрации, а владельцем ссылки только что доказано,
   * что почта его.
   */
  async startSession(
    input: { userId: string; organizationId: string; userAgentFamily?: string | null },
    now = new Date(),
  ): Promise<LoginResult> {
    const user = await this.prisma.db.user.findUnique({ where: { id: input.userId } });
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException(WRONG);
    await this.assertOrganizationOpen(input.organizationId);

    const token = newSessionToken();
    const expiresAt = sessionExpiry(now);
    await this.prisma.db.session.create({
      data: {
        userId: user.id,
        organizationId: input.organizationId,
        tokenHash: hashSessionToken(token),
        userAgent: input.userAgentFamily ?? null,
        expiresAt,
      },
    });
    await this.prisma.db.user.update({
      where: { id: user.id },
      data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: now },
    });
    // Вход без пароля — тем более в журнал: раньше он не оставлял следа (аудит 26.09, С-7)
    await this.record(user.id, 'user.login', { via: 'email-link' });

    return {
      token,
      expiresAt: expiresAt.toISOString(),
      user: visible(user, input.organizationId, await this.access(user.id, input.organizationId)),
    };
  }

  /** Кто пришёл с этим токеном. Негодный токен — это `null`, а не исключение: решает вызывающий. */
  async whoami(
    token: string,
    now = new Date(),
  ): Promise<{
    user: SignedInUser;
    organization: SignedInOrganization | null;
    expiresAt: string;
  } | null> {
    const found = await this.session(token, now);
    if (!found) return null;
    // Продление сессии при работе (§13.5, PR #29) касалось только входа по коду: смена по паролю
    // кончается через 12 часов намеренно (ADR-049). Вход по коду снят 20.09.2026 — продлевать стало
    // нечего, и ветка убрана, чтобы не выглядеть работающей. Продлевать ли смену по паролю — вопрос
    // к владельцу (Q-152), а не решение правки-сноса: `shouldRenewSession` в домене остался на месте.
    await this.prisma.db.session.update({
      where: { id: found.session.id },
      data: { lastSeenAt: now },
    });
    const expiresAt = found.session.expiresAt;
    const org = found.session.organization;
    return {
      user: visible(
        found.user,
        found.session.organizationId,
        await this.access(found.user.id, found.session.organizationId),
      ),
      organization: org
        ? {
            name: org.name,
            status: org.status,
            trialEndsAt: org.trialEndsAt ? org.trialEndsAt.toISOString() : null,
          }
        : null,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /** «Выйти». Идемпотентен: неизвестный или уже отозванный токен ничего не ломает и в журнал не пишет. */
  async logout(token: string, now = new Date()): Promise<void> {
    const found = await this.findByToken(token);
    if (!found || found.row.revokedAt !== null) return;
    await this.prisma.db.session.update({ where: { id: found.row.id }, data: { revokedAt: now } });
    await this.record(found.row.userId, 'user.logout', {});
  }

  /** Смена пароля своей учётной записи: прочие сессии этого сотрудника гаснут. */
  async changePassword(
    input: { token: string; currentPassword: string; newPassword: string },
    now = new Date(),
  ): Promise<void> {
    const found = await this.session(input.token, now);
    if (!found) throw new UnauthorizedException('Войдите заново: сессия не годится');

    const full = await this.prisma.db.user.findUnique({ where: { id: found.user.id } });
    if (!full || !(await checkPasswordQueued(input.currentPassword, full.passwordHash)))
      throw new UnauthorizedException('Неверный текущий пароль');

    const policy = checkPassword(input.newPassword);
    if (!policy.ok) throw new BadRequestException(`Пароль не годится: ${policy.reason}`);

    await this.prisma.db.user.update({
      where: { id: full.id },
      data: { passwordHash: await hashPasswordQueued(input.newPassword) },
    });
    const { count } = await this.prisma.db.session.updateMany({
      where: { userId: full.id, revokedAt: null, id: { not: found.session.id } },
      data: { revokedAt: now },
    });
    await this.record(full.id, 'user.password.changed', { sessionsRevoked: count });
  }

  /**
   * Строка сессии по ключу: сначала отпечаток пароля, потом — если задан секрет — отпечаток кода.
   * Каким отпечатком нашли, тем и живёт сессия: у входов разные сроки (12 часов и 30 суток), и
   * продлевать их по одному правилу нельзя.
   */
  private async findByToken(token: string) {
    const byHash = (tokenHash: string) =>
      this.prisma.db.session.findUnique({
        where: { tokenHash },
        include: { user: true, organization: true },
      });
    const own = await byHash(hashSessionToken(token));
    return own ? { row: own } : null;
  }

  private async session(token: string, now: Date) {
    if (!token) return null;
    const found = await this.findByToken(token);
    if (!found?.row.user) return null;
    if (sessionState(found.row, now) !== 'active') return null;
    if (found.row.user.status !== 'ACTIVE') return null;
    // Приостановленная организация — ни одной живой сессии (ADR-046, аудит 26.09, С-4)
    if (found.row.organization?.status === 'SUSPENDED') return null;
    // Исключённый из организации — сессия гаснет сразу: раньше роль подставлялась «сотрудник», и сессия жила до
    // конца смены (аудит 26.09, С-10)
    const membership = await this.prisma.db.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: found.row.userId,
          organizationId: found.row.organizationId,
        },
      },
      select: { role: true },
    });
    if (!membership) return null;
    return { session: found.row, user: found.row.user };
  }

  /** Организация приостановлена — входа нет ни паролем, ни по ссылке */
  private async assertOrganizationOpen(organizationId: string): Promise<void> {
    const org = await this.prisma.db.organization.findUnique({
      where: { id: organizationId },
      select: { status: true },
    });
    if (org?.status === 'SUSPENDED') throw new ForbiddenException(ORGANIZATION_SUSPENDED_MESSAGE);
  }

  /**
   * Роль человека в организации сессии и отметка главного администратора (DATA_MODEL §16). Два маленьких запроса по
   * ключу: читаются при каждом запросе, и отозванная отметка или сменённая роль действуют сразу, без нового входа.
   */
  private async access(userId: string, organizationId: string): Promise<Access> {
    const [membership, admin] = await Promise.all([
      this.prisma.db.membership.findUnique({
        where: { userId_organizationId: { userId, organizationId } },
        select: { role: true },
      }),
      this.prisma.db.platformAdmin.findUnique({ where: { userId }, select: { revokedAt: true } }),
    ]);
    return {
      // без членства сессии не бывает (§13.5); если его сняли — прав владельца точно нет
      role: membership?.role ?? 'STAFF',
      platformAdmin: admin !== null && admin.revokedAt === null,
    };
  }

  /** Журнал: кто и что сделал. Пароли и токены здесь не появляются никогда. */
  private async record(
    userId: string,
    action: string,
    after: Record<string, unknown>,
  ): Promise<void> {
    const json = JSON.parse(JSON.stringify(after));
    await this.prisma.db.auditLog.create({
      data: { userId, entityType: 'user', entityId: userId, action, after: json },
    });
  }
}
