import 'reflect-metadata';
import { ConflictException, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { NEW_PROPERTY_DEFAULTS, createPropertyInChain } from '@pms/database';
import {
  hashSessionToken,
  invitationLetter,
  newSessionToken,
  resetExpiry,
  resetLink,
  trialEndsAt,
  type BusinessVertical,
} from '@pms/domain';
import { assertRegistrationVertical } from '../auth/registration-contract';
import type { Mailer } from '../auth/password-reset.service';
import { PrismaService } from '../database/prisma.provider';

/** Почта и адрес стойки для ссылки: те же, что у сброса пароля (`AuthModule`), общий порт отправки писем */
export const PLATFORM_MAILER = Symbol('PLATFORM_MAILER');
export const PLATFORM_APP_URL = Symbol('PLATFORM_APP_URL');

export const OWNER_EMAIL_TAKEN = 'Эта почта уже зарегистрирована';
export const HOTEL_NAME_TAKEN = 'Гостиница с таким названием уже есть: укажите другое название';
export const OWNER_HAS_PASSWORD = 'Владелец уже задал пароль: ссылка не нужна';
export const OWNER_LINK_TOO_OFTEN = 'Письмо уже отправляли: повторить можно через несколько минут';

/** Не чаще одного письма на почту в пять минут, как у сброса пароля: иначе ящик можно завалить письмами */
const REPEAT_MINUTES = 5;

export interface OrganizationCreateInput {
  name: string;
  ownerEmail: string;
  vertical: BusinessVertical;
  by: string | null;
}
export interface OrganizationCreateResult {
  organizationId: string;
  ownerLinkSent: boolean;
}

/**
 * Организацию заводит главный администратор (ORG2, ADR-ORG2, Q-283): организация, первый филиал и владелец без пароля
 * одной транзакцией, потом владельцу уходит ссылка «задайте пароль». Ссылка та же, что у приглашённых сотрудников
 * (`password_resets`: в базе только хеш, одноразовая, 24 часа, подтверждает почту). Токен наружу не отдаётся никому,
 * в том числе главному администратору. Чужой пароль он не меняет: повторная ссылка только владельцу без пароля.
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
    // направление салона и ресторана только для почт из списка пилота, как при самостоятельной регистрации
    assertRegistrationVertical(input.vertical, input.ownerEmail);
    if (input.vertical === 'HOSPITALITY') {
      const namesake = await this.prisma.db.property.findFirst({
        where: { name: { equals: input.name, mode: 'insensitive' } },
        select: { id: true },
      });
      if (namesake) throw new ConflictException(HOTEL_NAME_TAKEN);
    }
    const token = newSessionToken();
    let organizationId: string;
    try {
      organizationId = await this.prisma.db.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: { name: input.name, status: 'TRIAL', trialEndsAt: trialEndsAt(now) },
          select: { id: true },
        });
        // первый филиал сразу, как при регистрации: без него вошедший упирался бы в «объект не настроен»
        if (input.vertical === 'HOSPITALITY') {
          await createPropertyInChain(tx, org.id, { name: input.name, ...NEW_PROPERTY_DEFAULTS });
        } else {
          const business = await tx.business.create({
            data: { organizationId: org.id, name: input.name, vertical: input.vertical },
            select: { id: true },
          });
          await tx.location.create({
            data: {
              businessId: business.id,
              name: input.name,
              timezone: NEW_PROPERTY_DEFAULTS.timezone,
              currency: NEW_PROPERTY_DEFAULTS.currency,
            },
          });
        }
        // человек без пароля (`password_hash = ''`), так же заводят приглашённых; вход ему откроет только ссылка
        const user = await tx.user.create({
          data: { email: input.ownerEmail, status: 'ACTIVE' },
          select: { id: true },
        });
        await tx.membership.create({ data: { userId: user.id, organizationId: org.id, role: 'OWNER' } });
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
            after: { name: input.name, ownerEmail: input.ownerEmail, vertical: input.vertical },
          },
        });
        return org.id;
      });
    } catch (e) {
      if (typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'P2002')
        throw new ConflictException(OWNER_EMAIL_TAKEN);
      throw e;
    }
    return { organizationId, ownerLinkSent: await this.send(input.ownerEmail, token, now) };
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
