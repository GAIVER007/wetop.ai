import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseInterceptors,
} from '@nestjs/common';
import { Prisma } from '@pms/database';
import {
  checkPassword,
  hashSessionToken,
  isPersonNameShaped,
  newSessionToken,
  normalizePersonName,
  normalizePhone,
  validEmail,
} from '@pms/domain';
import { Access } from '../auth/access.decorator';
import { hashPasswordQueued } from '../auth/attempt-limits';
import { appUrlFromEnv, type Mailer } from '../auth/password-reset.service';
import { Public } from '../auth/public.decorator';
import { currentUserId } from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';
import { ServiceDatabaseInterceptor } from '../database/service-database.interceptor';
import { requirePlatformAdmin } from './admin';
import { PLATFORM_MAILER } from './organization-creation';
import {
  buildPartnerCabinet,
  nextPartnerCode,
  parsePartnerProfile,
  partnerLinks,
  partnerScore,
  type PartnerCabinetView,
  type PartnerLevel,
  type PartnerProfileInput,
} from './partner-cabinet';
import { planPayoutsOf } from './partners';

/**
 * Кабинет партнёра WETOP (владелец 31.10.2026; ТЗ VTOP 01.11.2026; DATA_MODEL §63.3, миграция 178).
 * Приглашение выдаёт главный администратор из «Партнёров WETOP»; партнёр по ссылке сам вводит имя, почту и пароль,
 * подтверждает почту письмом и дальше входит обычным «Войти». Кабинет отдаётся только партнёру пользователя сессии:
 * партнёр не выбирается ни id, ни кодом из запроса. Таблицы платформенные: служебная роль базы, права здесь в коде.
 */
export const PARTNER_CABINET_REPOSITORY = Symbol('PARTNER_CABINET_REPOSITORY');
export const PARTNER_INVITE_INVALID = 'Приглашение недействительно или уже использовано. Попросите новое у WETOP.';
export const PARTNER_NOT_PARTNER = 'Кабинет партнёра открыт только партнёрам WETOP.';
export const PARTNER_NO_INVITE = 'Партнёра нет или он не работает.';
export const PARTNER_JOIN_NAME = 'Укажите имя и фамилию';
export const PARTNER_JOIN_EMAIL = 'Проверьте почту';
export const PARTNER_JOIN_PRIVACY = 'Нужно согласие с политикой конфиденциальности';
export const PARTNER_JOIN_PASSWORD_MISMATCH = 'Пароли не совпадают';
export const PARTNER_JOIN_PHONE = 'Проверьте телефон: от 10 до 15 цифр';
export const PARTNER_JOIN_TAKEN = 'Эта почта уже зарегистрирована в WETOP. Войдите или укажите другую.';

/** Приглашение действует 7 суток */
const INVITE_DAYS = 7;

export interface PartnerCabinet {
  partner: { name: string; code: string; percentBp: number };
  /** Профиль и карточка VTOP (§63.4); старый ответ без поля тоже читается */
  profile?: {
    specialization: string | null;
    city: string | null;
    experienceYears: number | null;
    about: string | null;
    phone: string | null;
    since: string;
    score: number;
    level: PartnerLevel;
  };
  links: { client: string };
  view: PartnerCabinetView;
}
export type PartnerJoinResult =
  | { ok: true; email: string; sent: boolean }
  | { ok: false; reason: 'invalid' | 'taken' };

export interface PartnerCabinetRepository {
  invite(input: { partnerId: string; by: string | null }): Promise<{ token: string; email: string | null; code: string } | null>;
  preview(token: string): Promise<{ partnerName: string; email: string | null } | null>;
  join(
    token: string,
    input: { name: string; email: string; passwordHash: string; phone: string | null },
  ): Promise<PartnerJoinResult>;
  cabinet(userId: string): Promise<PartnerCabinet | null>;
  /** Профиль своего партнёра (§63.4); false: пользователь не партнёр */
  saveProfile(userId: string, input: PartnerProfileInput): Promise<boolean>;
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

@Controller()
@UseInterceptors(ServiceDatabaseInterceptor)
export class PartnerController {
  constructor(
    @Inject(PARTNER_CABINET_REPOSITORY) private readonly repo: PartnerCabinetRepository,
    @Optional() @Inject(PLATFORM_MAILER) private readonly mailer: Mailer | null = null,
  ) {}

  /** «Пригласить» в «Партнёрах WETOP»: одноразовая ссылка; почта партнёра задана: письмо со ссылкой */
  @Access('platform')
  @Post('platform/partners/:id/invite')
  async invite(@Param('id', new ParseUUIDPipe()) id: string) {
    requirePlatformAdmin();
    const made = await this.repo.invite({ partnerId: id, by: currentUserId() });
    if (!made) throw new NotFoundException(PARTNER_NO_INVITE);
    // адрес из ТЗ 01.11.2026; старый `/partner/join/<токен>` тоже открывается
    const link = `${appUrlFromEnv()}/partner/invite/${encodeURIComponent(made.token)}`;
    let sent = false;
    if (made.email && this.mailer) {
      try {
        await this.mailer.send({
          to: made.email,
          subject: 'WETOP: приглашение в кабинет партнёра',
          text: [
            'Здравствуйте.',
            '',
            `Вас пригласили партнёром WETOP. Ваш Partner ID: ${made.code}.`,
            'Откройте ссылку, укажите имя, почту и пароль, подтвердите почту, и кабинет партнёра откроется:',
            link,
            '',
            `Ссылка действует ${INVITE_DAYS} дней и только один раз.`,
          ].join('\n'),
        });
        sent = true;
      } catch {
        sent = false;
      }
    }
    return { link, email: made.email, code: made.code, ...(this.mailer ? { sent } : {}) };
  }

  @Public()
  @Get('partner/join/:token')
  @Header('Cache-Control', 'no-store')
  async preview(@Param('token') token: string) {
    const p = await this.repo.preview(token);
    if (!p) throw new NotFoundException(PARTNER_INVITE_INVALID);
    return p;
  }

  /** Регистрация партнёра по приглашению: учётка, письмо подтверждения уходит обычным «выслать заново» стойки */
  @Public()
  @Post('partner/join/:token')
  async join(@Param('token') token: string, @Body() body: unknown) {
    const b = (body ?? {}) as Record<string, unknown>;
    if (!(await this.repo.preview(token))) throw new NotFoundException(PARTNER_INVITE_INVALID);
    const name = text(b['name'], 200);
    if (!isPersonNameShaped(name)) throw new BadRequestException(PARTNER_JOIN_NAME);
    const email = validEmail(text(b['email'], 320));
    if (!email) throw new BadRequestException(PARTNER_JOIN_EMAIL);
    const password = typeof b['password'] === 'string' ? b['password'].slice(0, 200) : '';
    const strength = checkPassword(password);
    if (!strength.ok) throw new BadRequestException(`Пароль не годится: ${strength.reason}`);
    // повтор пароля и телефон (ТЗ 01.11.2026); старая форма без полей проходит
    if (typeof b['passwordConfirm'] === 'string' && b['passwordConfirm'] !== password) throw new BadRequestException(PARTNER_JOIN_PASSWORD_MISMATCH);
    const rawPhone = text(b['phone'], 40);
    const phone = rawPhone ? normalizePhone(rawPhone) : null;
    if (rawPhone && !phone) throw new BadRequestException(PARTNER_JOIN_PHONE);
    if (b['privacyAccepted'] !== true) throw new BadRequestException(PARTNER_JOIN_PRIVACY);
    const result = await this.repo.join(token, { name: normalizePersonName(name), email, passwordHash: await hashPasswordQueued(password), phone });
    if (!result.ok) {
      if (result.reason === 'taken') throw new BadRequestException(PARTNER_JOIN_TAKEN);
      throw new NotFoundException(PARTNER_INVITE_INVALID);
    }
    return { pendingVerification: true, email: result.email, sent: result.sent };
  }

  /** «Мой профиль» (§63.4): только поля, которые партнёр меняет сам; партнёр по сессии, не по запросу */
  @Access('self')
  @Put('partner/me/profile')
  async saveProfile(@Body() body: unknown) {
    const userId = currentUserId();
    if (!userId) throw new ForbiddenException(PARTNER_NOT_PARTNER);
    const parsed = parsePartnerProfile(body);
    if (!parsed.ok) throw new BadRequestException(parsed.error);
    if (!(await this.repo.saveProfile(userId, parsed.value))) throw new ForbiddenException(PARTNER_NOT_PARTNER);
    return { ok: true };
  }

  /** Кабинет: только партнёр пользователя этой сессии */
  @Access('self')
  @Get('partner/me')
  @Header('Cache-Control', 'no-store')
  async me() {
    const userId = currentUserId();
    const cab = userId ? await this.repo.cabinet(userId) : null;
    if (!cab) throw new ForbiddenException(PARTNER_NOT_PARTNER);
    return cab;
  }
}

@Injectable()
export class PrismaPartnerCabinetRepository implements PartnerCabinetRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async ensureCode(tx: Prisma.TransactionClient, partnerId: string, code: string | null): Promise<string> {
    if (code) return code;
    // один номер за раз: два одновременных приглашения не получат один Partner ID
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('platform.partner.code', 0))::text`;
    const fresh = await tx.platformPartner.findUnique({ where: { id: partnerId }, select: { code: true } });
    if (fresh?.code) return fresh.code;
    const taken = await tx.platformPartner.findMany({ where: { code: { not: null } }, select: { code: true } });
    const next = nextPartnerCode(taken.flatMap((p) => (p.code ? [p.code] : [])));
    await tx.platformPartner.update({ where: { id: partnerId }, data: { code: next, updatedAt: new Date() } });
    return next;
  }

  async invite(input: { partnerId: string; by: string | null }) {
    const now = new Date();
    return this.prisma.db.$transaction(async (tx) => {
      const p = await tx.platformPartner.findUnique({ where: { id: input.partnerId } });
      if (!p || !p.active) return null;
      const code = await this.ensureCode(tx, p.id, p.code);
      // новое приглашение гасит прежние неиспользованные
      await tx.platformPartnerInvite.updateMany({
        where: { partnerId: p.id, acceptedAt: null, expiresAt: { gt: now } },
        data: { expiresAt: now },
      });
      const token = newSessionToken();
      await tx.platformPartnerInvite.create({
        data: {
          id: randomUUID(),
          partnerId: p.id,
          tokenHash: hashSessionToken(token),
          expiresAt: new Date(now.getTime() + INVITE_DAYS * 86_400_000),
          createdBy: input.by,
        },
      });
      await tx.auditLog.create({
        data: { userId: input.by, entityType: 'platform_partner', entityId: p.id, action: 'platform.partner.invited', after: { code } },
      });
      return { token, email: p.email, code };
    });
  }

  private async liveInvite(db: Prisma.TransactionClient | PrismaService['db'], token: string) {
    if (!token || token.length > 200) return null;
    const row = await db.platformPartnerInvite.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: { partner: true },
    });
    if (!row || row.acceptedAt || row.expiresAt <= new Date() || !row.partner.active || row.partner.userId) return null;
    return row;
  }

  async preview(token: string) {
    const row = await this.liveInvite(this.prisma.db, token);
    return row ? { partnerName: row.partner.name, email: row.partner.email } : null;
  }

  async join(token: string, input: { name: string; email: string; passwordHash: string; phone: string | null }): Promise<PartnerJoinResult> {
    try {
      return await this.prisma.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`platform.partner.invite:${hashSessionToken(token)}`}, 0))::text`;
        const row = await this.liveInvite(tx, token);
        if (!row) return { ok: false as const, reason: 'invalid' as const };
        const now = new Date();
        // рабочее место партнёра для сессии: организация без бизнесов, в клиенты WETOP не входит (§63.3)
        const org = await tx.organization.create({
          data: { name: `Партнёр WETOP ${row.partner.code ?? ''}`.trim(), status: 'ACTIVE', trialEndsAt: null },
          select: { id: true },
        });
        const user = await tx.user.create({
          data: { email: input.email, name: input.name, passwordHash: input.passwordHash, status: 'ACTIVE' },
          select: { id: true },
        });
        // членство только для сессии (§13.5): «Личный кабинет», не владелец бизнеса (§63.3, аудит 01.11.2026)
        await tx.membership.create({ data: { userId: user.id, organizationId: org.id, role: 'EMPLOYEE' } });
        await tx.platformPartner.update({
          where: { id: row.partnerId },
          data: { userId: user.id, organizationId: org.id, updatedAt: now, ...(input.phone ? { phone: input.phone } : {}) },
        });
        await tx.platformPartnerInvite.update({ where: { id: row.id }, data: { acceptedAt: now, acceptedBy: user.id } });
        await tx.auditLog.create({
          data: { userId: user.id, entityType: 'platform_partner', entityId: row.partnerId, action: 'platform.partner.joined', after: { code: row.partner.code } },
        });
        return { ok: true as const, email: input.email, sent: false };
      });
    } catch (e) {
      if (typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'P2002') return { ok: false, reason: 'taken' };
      throw e;
    }
  }

  async cabinet(userId: string): Promise<PartnerCabinet | null> {
    const db = this.prisma.db;
    const me = await db.platformPartner.findFirst({ where: { userId, active: true } });
    if (!me) return null;
    const code = me.code ?? (await db.$transaction((tx) => this.ensureCode(tx, me.id, null)));
    const [partners, links, payments, subs, payouts] = await Promise.all([
      db.platformPartner.findMany({ select: { id: true, active: true, percentBp: true } }),
      db.platformClientPartner.findMany({ where: { partnerId: { not: null } }, select: { organizationId: true, partnerId: true, source: true, channel: true } }),
      db.platformPayment.findMany({ select: { organizationId: true, amountCents: true, paidOn: true, voidedAt: true, kind: true } }),
      db.platformSubscription.findMany({ select: { organizationId: true, plan: { select: { partnerPayoutCents: true } } } }),
      db.platformExpense.findMany({ where: { category: 'PARTNERS', partnerId: me.id }, select: { partnerId: true, amountCents: true, spentOn: true, voidedAt: true, note: true } }),
    ]);
    const ownIds = links.filter((l) => l.partnerId === me.id).map((l) => l.organizationId);
    const orgs = ownIds.length
      ? await db.organization.findMany({ where: { id: { in: ownIds } }, select: { id: true, name: true, status: true, trialEndsAt: true, createdAt: true } })
      : [];
    const day = (d: Date) => d.toISOString().slice(0, 10);
    const view = buildPartnerCabinet(
      {
        partner: { id: me.id, name: me.name, code, percentBp: me.percentBp },
        partners: partners.map((p) => ({ id: p.id, active: p.active })),
        links: links.flatMap((l) => (l.partnerId ? [{ organizationId: l.organizationId, partnerId: l.partnerId, source: l.source, channel: l.channel }] : [])),
        organizations: orgs.map((o) => ({ id: o.id, name: o.name, status: o.status, trialEndsAt: o.trialEndsAt ? o.trialEndsAt.toISOString() : null, createdAt: o.createdAt.toISOString() })),
        payments: payments.map((p) => ({ organizationId: p.organizationId, amountCents: p.amountCents, paidOn: day(p.paidOn), voided: p.voidedAt !== null, kind: p.kind === 'ADDON' ? 'ADDON' : 'PLAN' })),
        // по тарифу первого чека клиента, не нынешней подписки (аудит 01.11.2026)
        planPayouts: planPayoutsOf(
          payments.map((p) => ({ organizationId: p.organizationId, amountCents: p.amountCents, paidOn: day(p.paidOn), voided: p.voidedAt !== null, kind: p.kind === 'ADDON' ? ('ADDON' as const) : ('PLAN' as const) })),
          await db.platformPlan.findMany({ select: { priceCents: true, partnerPayoutCents: true } }),
          subs.flatMap((s) => (s.plan?.partnerPayoutCents != null ? [{ organizationId: s.organizationId, payoutCents: s.plan.partnerPayoutCents }] : [])),
        ),
        payouts: payouts.flatMap((p) => (p.partnerId ? [{ partnerId: p.partnerId, amountCents: p.amountCents, spentOn: day(p.spentOn), voided: p.voidedAt !== null, note: p.note }] : [])),
      },
      new Date(),
    );
    const alive = view.clients.filter((c) => c.status === 'TRIAL' || c.paid).length;
    const sc = partnerScore({ clients: view.stats.clients, paid: view.stats.paid, alive });
    return {
      partner: { name: me.name, code, percentBp: me.percentBp },
      profile: {
        specialization: me.specialization,
        city: me.city,
        experienceYears: me.experienceYears,
        about: me.about,
        phone: me.phone,
        since: me.createdAt.toISOString().slice(0, 10),
        score: sc.score,
        level: sc.level,
      },
      links: partnerLinks(appUrlFromEnv(), code),
      view,
    };
  }

  async saveProfile(userId: string, input: PartnerProfileInput): Promise<boolean> {
    return this.prisma.db.$transaction(async (tx) => {
      const me = await tx.platformPartner.findFirst({ where: { userId, active: true } });
      if (!me) return false;
      const before = { specialization: me.specialization, city: me.city, experienceYears: me.experienceYears, about: me.about, phone: me.phone };
      await tx.platformPartner.update({ where: { id: me.id }, data: { ...input, updatedAt: new Date() } });
      // История (антикража): было → стало
      await tx.auditLog.create({
        data: { userId, entityType: 'platform_partner', entityId: me.id, action: 'platform.partner.profile', before, after: { ...input } },
      });
      return true;
    });
  }
}
