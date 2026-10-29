import 'reflect-metadata';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Header,
  Inject,
  Injectable,
  NotFoundException,
  Param,
  Put,
  UseInterceptors,
} from '@nestjs/common';
import type { BusinessVertical, OrganizationStatus } from '@pms/database';
import { PrismaService } from '../database/prisma.provider';
import { ServiceDatabaseInterceptor } from '../database/service-database.interceptor';
import { currentUserId } from '../auth/request-context';
import { Access } from '../auth/access.decorator';
import { requirePlatformAdmin } from './admin';
import { PLATFORM_NO_ORGANIZATION } from './platform.controller';

export const CLIENT_CARD_REPOSITORY = Symbol('CLIENT_CARD_REPOSITORY');
export const TRIAL_EXTEND_MESSAGE = 'Продлить пробный: от 1 до 30 дней целым числом';
export const TRIAL_NOT_FOR_PAYING = 'Пробный продлевается только пробному клиенту или клиенту «только чтение»';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = 24 * 60 * 60 * 1000;
/** Сколько последних действий показывает карточка */
const JOURNAL_LIMIT = 30;

export interface ClientCardRow {
  id: string;
  name: string;
  status: OrganizationStatus;
  createdAt: Date;
  trialEndsAt: Date | null;
  members: Array<{ email: string; name: string | null; role: string; lastLoginAt: Date | null }>;
  locations: Array<{ name: string; business: string; vertical: BusinessVertical }>;
  journal: Array<{ at: Date; action: string; by: string | null; after: unknown }>;
}

export interface ClientCardRepository {
  card(id: string): Promise<ClientCardRow | null>;
  /** Новый конец пробного, статус TRIAL и строка журнала одной транзакцией */
  extendTrial(input: { organizationId: string; until: Date; by: string | null; before: OrganizationStatus }): Promise<void>;
}

/** Новый конец пробного: срок ещё идёт, прибавляем к нему; уже прошёл или не задан, считаем от сейчас */
export function trialExtendedUntil(trialEndsAt: Date | null, now: Date, days: number): Date {
  const from = trialEndsAt && trialEndsAt > now ? trialEndsAt : now;
  return new Date(from.getTime() + days * DAY);
}

/** Что главному администратору в журнале: действие, кто, и для статуса новый статус с заметкой */
function journalJson(j: ClientCardRow['journal'][number]) {
  const after = (j.after && typeof j.after === 'object' ? j.after : {}) as Record<string, unknown>;
  return {
    at: j.at.toISOString(),
    action: j.action,
    by: j.by,
    status: typeof after['status'] === 'string' ? after['status'] : null,
    note: typeof after['note'] === 'string' ? after['note'] : null,
  };
}

function cardJson(c: ClientCardRow) {
  return {
    id: c.id,
    name: c.name,
    status: c.status,
    createdAt: c.createdAt.toISOString(),
    trialEndsAt: c.trialEndsAt?.toISOString() ?? null,
    members: c.members.map((m) => ({
      email: m.email,
      name: m.name,
      owner: m.role === 'OWNER',
      lastLoginAt: m.lastLoginAt?.toISOString() ?? null,
    })),
    locations: c.locations,
    journal: c.journal.map(journalJson),
  };
}

@Injectable()
export class PrismaClientCardRepository implements ClientCardRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async card(id: string): Promise<ClientCardRow | null> {
    const db = this.prisma.db;
    const o = await db.organization.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        trialEndsAt: true,
        memberships: {
          orderBy: { createdAt: 'asc' },
          select: { role: true, user: { select: { email: true, name: true, lastLoginAt: true } } },
        },
        businesses: {
          orderBy: { createdAt: 'asc' },
          select: { name: true, vertical: true, locations: { orderBy: { createdAt: 'asc' }, select: { name: true } } },
        },
      },
    });
    if (!o) return null;
    // действия с самой организацией: статус, пробный, оплаты, подписка, расширения, название, архив
    const journal = await db.auditLog.findMany({
      where: { entityType: 'organization', entityId: id },
      orderBy: { createdAt: 'desc' },
      take: JOURNAL_LIMIT,
      select: { createdAt: true, action: true, after: true, user: { select: { email: true } } },
    });
    return {
      id: o.id,
      name: o.name,
      status: o.status,
      createdAt: o.createdAt,
      trialEndsAt: o.trialEndsAt,
      members: o.memberships.map((m) => ({ email: m.user.email, name: m.user.name, role: m.role, lastLoginAt: m.user.lastLoginAt })),
      locations: o.businesses.flatMap((b) => b.locations.map((l) => ({ name: l.name, business: b.name, vertical: b.vertical }))),
      journal: journal.map((j) => ({ at: j.createdAt, action: j.action, by: j.user?.email ?? null, after: j.after })),
    };
  }

  async extendTrial(input: { organizationId: string; until: Date; by: string | null; before: OrganizationStatus }): Promise<void> {
    await this.prisma.db.$transaction(async (tx) => {
      await tx.organization.update({ where: { id: input.organizationId }, data: { status: 'TRIAL', trialEndsAt: input.until } });
      await tx.auditLog.create({
        data: {
          userId: input.by,
          entityType: 'organization',
          entityId: input.organizationId,
          action: 'organization.trial_extended',
          before: { status: input.before },
          after: { status: 'TRIAL', trialEndsAt: input.until.toISOString() },
        },
      });
    });
  }
}

/**
 * Карточка клиента кабинета руководителя (план 2026-10-29-owner-cabinet-full.md, срез 3): люди, филиалы и журнал
 * действий с организацией; «продлить пробный» на 1–30 дней. Оплата, «только чтение», расширения и архив остаются
 * прежними запросами раздела «Платформа». Только главному администратору (ADR-083).
 */
@Access('platform')
@UseInterceptors(ServiceDatabaseInterceptor)
@Controller('platform')
export class ClientCardController {
  constructor(@Inject(CLIENT_CARD_REPOSITORY) private readonly repo: ClientCardRepository) {}

  @Get('organizations/:id/card')
  @Header('Cache-Control', 'no-store')
  async card(@Param('id') id: string) {
    requirePlatformAdmin();
    if (!UUID.test(id)) throw new BadRequestException('Организация: ожидается идентификатор');
    const c = await this.repo.card(id);
    if (!c) throw new NotFoundException(PLATFORM_NO_ORGANIZATION);
    return cardJson(c);
  }

  @Put('organizations/:id/trial')
  async extendTrial(@Param('id') id: string, @Body() body: unknown) {
    requirePlatformAdmin();
    if (!UUID.test(id)) throw new BadRequestException('Организация: ожидается идентификатор');
    const days = (body ?? {}) && typeof body === 'object' ? (body as { days?: unknown }).days : undefined;
    if (typeof days !== 'number' || !Number.isInteger(days) || days < 1 || days > 30) {
      throw new BadRequestException(TRIAL_EXTEND_MESSAGE);
    }
    const c = await this.repo.card(id);
    if (!c) throw new NotFoundException(PLATFORM_NO_ORGANIZATION);
    if (c.status !== 'TRIAL' && c.status !== 'READ_ONLY') throw new ConflictException(TRIAL_NOT_FOR_PAYING);
    const until = trialExtendedUntil(c.trialEndsAt, new Date(), days);
    await this.repo.extendTrial({ organizationId: id, until, by: currentUserId(), before: c.status });
    return cardJson((await this.repo.card(id))!);
  }
}
