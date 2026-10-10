import 'reflect-metadata';
import { ConflictException, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { NEW_PROPERTY_DEFAULTS, createBeautyLocationInChain, createPropertyInChain } from '@pms/database';
import {
  hashSessionToken,
  invitationLetter,
  newSessionToken,
  resetExpiry,
  resetLink,
  type OrganizationCreate,
} from '@pms/domain';
import type { Mailer } from '../auth/password-reset.service';
import { PrismaService } from '../database/prisma.provider';

/** Почта и адрес стойки для ссылки: те же, что у сброса пароля (`AuthModule`), общий порт отправки писем */
export const PLATFORM_MAILER = Symbol('PLATFORM_MAILER');
export const PLATFORM_APP_URL = Symbol('PLATFORM_APP_URL');

export const ORGANIZATION_NAME_TAKEN = 'Организация с таким названием уже есть';
export const REQUEST_REUSED = 'Этот запрос уже сохранён с другими данными. Обновите страницу перед повтором.';
export const OWNER_EMAIL_TAKEN = 'Эта почта уже зарегистрирована';
export const HOTEL_NAME_TAKEN = 'Гостиница с таким названием уже есть: укажите другое название';
export const OWNER_HAS_PASSWORD = 'Владелец уже задал пароль: ссылка не нужна';
export const OWNER_LINK_TOO_OFTEN = 'Письмо уже отправляли: повторить можно через несколько минут';

/** Не чаще одного письма на почту в пять минут, как у сброса пароля: иначе ящик можно завалить письмами */
const REPEAT_MINUTES = 5;

export type OrganizationCreateInput = OrganizationCreate & { by: string | null };
export interface OrganizationCreateResult {
  organizationId: string;
  ownerLinkSent: boolean;
  /** Тот же запрос уже выполняли (повтор по идентификатору): ничего не создано, письмо не шлётся */
  replay: boolean;
}

/**
 * Организацию заводит главный администратор (ORG2, ADR-ORG2, Q-283; окно «Создать организацию», ADR-159): организация
 * (`ACTIVE` сразу, пробного периода нет), бизнес выбранного направления с публичным названием, первый филиал по выбору
 * и владелец без пароля одной транзакцией, потом владельцу уходит ссылка «задайте пароль». Ссылка та же, что у
 * приглашённых сотрудников (`password_resets`: в базе только хеш, одноразовая, 24 часа, подтверждает почту). Токен
 * наружу не отдаётся никому, в том числе главному администратору. Чужой пароль он не меняет: повторная ссылка только
 * владельцу без пароля. Идентификатор запроса это идентификатор организации: повтор возвращает созданное.
 */
@Injectable()
export class OrganizationCreation {
  private readonly lastSent = new Map<string, number>();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PLATFORM_MAILER) private readonly mailer: Mailer | null,
    @Inject(PLATFORM_APP_URL) private readonly appUrl: string,
  ) {}

  async create(input: OrganizationCreateInput, now = new Date()): Promise<OrganizationCreateResult> {
    const existing = await this.prisma.db.organization.findUnique({
      where: { id: input.id },
      select: { id: true, name: true },
    });
    if (existing) {
      if (existing.name !== input.name) throw new ConflictException(REQUEST_REUSED);
      return { organizationId: existing.id, ownerLinkSent: false, replay: true };
    }
    const named = await this.prisma.db.organization.findFirst({
      where: { name: { equals: input.name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (named) throw new ConflictException(ORGANIZATION_NAME_TAKEN);
    if (input.vertical === 'HOSPITALITY' && input.firstBranch) {
      const namesake = await this.prisma.db.property.findFirst({
        where: { name: { equals: input.firstBranch.name, mode: 'insensitive' } },
        select: { id: true },
      });
      if (namesake) throw new ConflictException(HOTEL_NAME_TAKEN);
    }
    const token = newSessionToken();
    try {
      await this.prisma.db.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: { id: input.id, name: input.name, status: 'ACTIVE', reportingCurrency: input.currency },
          select: { id: true },
        });
        // бизнес с публичным названием заводится первым: цепочка объекта берёт самый ранний бизнес направления
        const business = await tx.business.create({
          data: { organizationId: org.id, name: input.brand, vertical: input.vertical },
          select: { id: true },
        });
        let locationId: string | null = null;
        const branch = input.firstBranch;
        if (branch) {
          const data = {
            name: branch.name,
            address: branch.address || null,
            phone: input.owner.phone,
            timezone: input.timezone,
            currency: input.currency,
          };
          if (input.vertical === 'HOSPITALITY') {
            locationId = (await createPropertyInChain(tx, org.id, { ...NEW_PROPERTY_DEFAULTS, ...data })).locationId;
          } else if (input.vertical === 'BEAUTY') {
            locationId = (await createBeautyLocationInChain(tx, org.id, data)).id;
          } else {
            locationId = (await tx.location.create({ data: { businessId: business.id, ...data } })).id;
          }
        }
        // человек без пароля (`password_hash = ''`), так же заводят приглашённых; вход ему откроет только ссылка
        const user = await tx.user.create({
          data: { email: input.owner.email, name: input.owner.name, status: 'ACTIVE' },
          select: { id: true },
        });
        await tx.membership.create({
          data: { userId: user.id, organizationId: org.id, role: 'OWNER', phone: input.owner.phone },
        });
        await tx.passwordReset.create({
          data: { userId: user.id, tokenHash: hashSessionToken(token), expiresAt: resetExpiry(now) },
        });
        await tx.auditLog.create({
          data: {
            userId: input.by,
            organizationId: org.id,
            entityType: 'organization',
            entityId: org.id,
            action: 'organization.created',
            // БИН и сайт пока без колонок в модели (Q-298): до решения они живут здесь
            after: {
              name: input.name,
              brand: input.brand,
              ownerEmail: input.owner.email,
              vertical: input.vertical,
              country: input.country,
              city: input.city,
              timezone: input.timezone,
              currency: input.currency,
              bin: input.bin,
              website: input.website,
              locationId,
            },
          },
        });
      });
    } catch (e) {
      if (typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'P2002')
        throw new ConflictException(OWNER_EMAIL_TAKEN);
      throw e;
    }
    return { organizationId: input.id, ownerLinkSent: await this.send(input.owner.email, token, now), replay: false };
  }

  /**
   * Новая ссылка владельцу, у которого пароля ещё нет (письмо не дошло, срок вышел). Прежняя ссылка гаснет. Владельцу,
   * который пароль уже задал, ссылка не выдаётся: чужой пароль главный администратор менять не может.
   */
  async resendOwnerLink(organizationId: string, now = new Date()): Promise<{ ownerLinkSent: boolean }> {
    const pending = await this.prisma.db.membership.findFirst({
      where: { organizationId, role: 'OWNER', user: { status: 'ACTIVE', passwordHash: '' } },
      orderBy: { createdAt: 'asc' },
      select: { user: { select: { id: true, email: true } } },
    });
    if (!pending) throw new ConflictException(OWNER_HAS_PASSWORD);
    const { id: userId, email } = pending.user;
    const last = this.lastSent.get(email);
    if (last !== undefined && now.getTime() - last < REPEAT_MINUTES * 60_000)
      throw new HttpException(OWNER_LINK_TOO_OFTEN, HttpStatus.TOO_MANY_REQUESTS);
    const token = newSessionToken();
    await this.prisma.db.$transaction(async (tx) => {
      await tx.passwordReset.updateMany({ where: { userId, usedAt: null }, data: { usedAt: now } });
      await tx.passwordReset.create({
        data: { userId, tokenHash: hashSessionToken(token), expiresAt: resetExpiry(now) },
      });
    });
    return { ownerLinkSent: await this.send(email, token, now) };
  }

  /** Письмо не ушло (нет настроек почты, отказ службы): организация остаётся, на карточке можно отправить ещё раз */
  private async send(to: string, token: string, now: Date): Promise<boolean> {
    if (!this.mailer) return false;
    const letter = invitationLetter({ name: null, link: resetLink(this.appUrl, token) });
    try {
      await this.mailer.send({ to, subject: letter.subject, text: letter.text });
    } catch {
      return false;
    }
    this.lastSent.set(to, now.getTime());
    return true;
  }
}
