import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import {
  DEFAULT_SELLER_PROFILE,
  pickSellerProfile,
  sellerFactsWindow,
  type SellerAddressForm,
  type SellerEmoji,
  type SellerFaqItem,
  type SellerFactsSource,
  type SellerProfileInput,
  type SellerReplyLength,
} from '@pms/domain';
import { auditUserId } from '../accounts/actor';
import type { BotAudit } from '../bots/audit';
import { PrismaService } from '../database/prisma.provider';

export const SELLER_PROFILES = Symbol('SELLER_PROFILES');
export const SELLER_FACTS = Symbol('SELLER_FACTS');
export const SELLER_AUDIT = Symbol('SELLER_AUDIT');
export const SELLER_ORGS = Symbol('SELLER_ORGS');
export const SELLER_CATALOG = Symbol('SELLER_CATALOG');

/** Организация для заведения у продавца (Э4) */
export interface SellerOrganizationRow {
  organizationId: string;
  name: string;
}

/**
 * Гостиницы для сверки с продавцом (Э4, ADR-083): организации со строкой расширения «ИИ-продавец» — любым статусом,
 * потому что погашенное расширение тоже уходит продавцу (active=false гасит виджет, Q-183), — и домены их сайтов.
 */
export interface SellerOrgsRepository {
  withExtension(): Promise<SellerOrganizationRow[]>;
  one(organizationId: string): Promise<SellerOrganizationRow | null>;
  /** Домены действующих сайтов организации («Настройки сайта», срез 8): с них открывается виджет */
  hosts(organizationId: string): Promise<string[]>;
}

/** Строка `seller_profiles` (DATA_MODEL §15): поля «Настроек» плюс отметки доставки продавцу */
export interface SellerProfileRow extends SellerProfileInput {
  organizationId: string;
  /** Инструкция продавцу одним текстом (ADR-097); есть — продавцу уходит она, а не поля */
  promptText: string | null;
  updatedAt: Date;
  updatedBy: string | null;
  /** Версия профиля (`updatedAt`), которую продавец принял */
  profileAppliedAt: Date | null;
  factsHash: string | null;
  factsAppliedAt: Date | null;
  lastError: string | null;
  lastErrorAt: Date | null;
}

export interface SellerProfilesRepository {
  get(organizationId: string): Promise<SellerProfileRow | null>;
  /** Правка «Настроек»: одна строка на организацию, в журнал действий — до и после, с автором */
  save(
    organizationId: string,
    profile: SellerProfileInput,
    userId: string | null,
    now: Date,
  ): Promise<SellerProfileRow>;
  /** Инструкция одним текстом (ADR-097): строки нет — заводится с полями по умолчанию, иначе факты не уйдут */
  savePrompt(
    organizationId: string,
    text: string,
    userId: string | null,
    now: Date,
  ): Promise<SellerProfileRow>;
  markProfileApplied(organizationId: string, version: Date): Promise<void>;
  markFactsApplied(organizationId: string, hash: string, at: Date): Promise<void>;
  markError(organizationId: string, message: string, at: Date): Promise<void>;
  clearError(organizationId: string): Promise<void>;
}

export interface SellerFactsRepository {
  /** Факты объекта организации; `null` — объекта у организации нет */
  load(organizationId: string, now: Date): Promise<SellerFactsSource | null>;
}

/**
 * Что каталог «ИИ-агентов» (SA1) читает у организации вошедшего. Только чтение; чужих строк здесь нет: организация —
 * из сессии, и таблицы под RLS (DATA_MODEL §17).
 */
export interface SellerCatalogPlacement {
  business: { id: string; name: string };
  location: { id: string; name: string };
}

export interface SellerCatalogDraft {
  id: string;
  name: string;
  updatedAt: Date;
}

export interface SellerCatalogRepository {
  /**
   * Business и Location объекта, которым сегодня пользуется продавец: самый ранний объект организации — то же правило,
   * что у фактов (`PrismaSellerFactsRepository`) и котировки. Это не выбор партнёра: выбор появится с агентом на
   * Location (SA1.5). `null` — у организации нет объекта.
   */
  placement(organizationId: string): Promise<SellerCatalogPlacement | null>;
  /** Черновики гостевого мастера (`seller_agents`): продавца они не запускают */
  drafts(organizationId: string, limit: number): Promise<SellerCatalogDraft[]>;
}

/** Действия сотрудника в разделе, которые продавец сам записать не может: он видит только ключ платформы */
/** Журнал раздела — общий для обоих ботов (`bots/audit.ts`) */
export type SellerAudit = BotAudit;

const faqOf = (value: unknown): SellerFaqItem[] =>
  Array.isArray(value)
    ? value
        .filter(
          (f): f is SellerFaqItem =>
            !!f &&
            typeof f === 'object' &&
            typeof (f as SellerFaqItem).question === 'string' &&
            typeof (f as SellerFaqItem).answer === 'string',
        )
        .map((f) => ({ question: f.question, answer: f.answer }))
    : [];

type ProfileRecord = {
  organizationId: string;
  botName: string | null;
  addressForm: SellerAddressForm;
  emoji: SellerEmoji;
  replyLength: SellerReplyLength;
  languages: string[];
  greeting: string;
  includedInPrice: string;
  extraCharges: string;
  houseRules: string;
  prohibitions: string[];
  callHumanWhen: string[];
  faq: unknown;
  promptText: string | null;
  updatedAt: Date;
  updatedBy: string | null;
  profileAppliedAt: Date | null;
  factsHash: string | null;
  factsAppliedAt: Date | null;
  lastError: string | null;
  lastErrorAt: Date | null;
};

const rowOf = (r: ProfileRecord): SellerProfileRow => ({
  organizationId: r.organizationId,
  botName: r.botName,
  addressForm: r.addressForm,
  emoji: r.emoji,
  replyLength: r.replyLength,
  languages: r.languages,
  greeting: r.greeting,
  includedInPrice: r.includedInPrice,
  extraCharges: r.extraCharges,
  houseRules: r.houseRules,
  prohibitions: r.prohibitions ?? [],
  callHumanWhen: r.callHumanWhen ?? [],
  faq: faqOf(r.faq),
  promptText: r.promptText ?? null,
  updatedAt: r.updatedAt,
  updatedBy: r.updatedBy,
  profileAppliedAt: r.profileAppliedAt,
  factsHash: r.factsHash,
  factsAppliedAt: r.factsAppliedAt,
  lastError: r.lastError,
  lastErrorAt: r.lastErrorAt,
});

@Injectable()
export class PrismaSellerProfilesRepository implements SellerProfilesRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async get(organizationId: string): Promise<SellerProfileRow | null> {
    const r = await this.prisma.db.sellerProfile.findUnique({ where: { organizationId } });
    return r ? rowOf(r as ProfileRecord) : null;
  }

  async save(
    organizationId: string,
    profile: SellerProfileInput,
    userId: string | null,
    now: Date,
  ): Promise<SellerProfileRow> {
    const fields = pickSellerProfile(profile);
    const data = {
      ...fields,
      faq: fields.faq.map((f) => ({ question: f.question, answer: f.answer })),
      updatedAt: now,
      updatedBy: userId,
    };
    return this.prisma.db.$transaction(async (tx) => {
      const before = await tx.sellerProfile.findUnique({ where: { organizationId } });
      const saved = await tx.sellerProfile.upsert({
        where: { organizationId },
        create: { organizationId, ...data },
        update: data,
      });
      // SECURITY.md §6: правка настроек продавца — в журнал; тексты — настройки владельца, не данные гостей
      await tx.auditLog.create({
        data: {
          userId: userId ?? auditUserId(),
          entityType: 'SellerProfile',
          entityId: organizationId,
          action: 'seller.profile.updated',
          ...(before
            ? {
                before: JSON.parse(
                  JSON.stringify(pickSellerProfile(rowOf(before as ProfileRecord))),
                ),
              }
            : {}),
          after: JSON.parse(JSON.stringify(fields)),
        },
      });
      return rowOf(saved as ProfileRecord);
    });
  }

  async savePrompt(
    organizationId: string,
    text: string,
    userId: string | null,
    now: Date,
  ): Promise<SellerProfileRow> {
    const defaults = pickSellerProfile(DEFAULT_SELLER_PROFILE);
    const stamp = { promptText: text, updatedAt: now, updatedBy: userId };
    return this.prisma.db.$transaction(async (tx) => {
      const saved = await tx.sellerProfile.upsert({
        where: { organizationId },
        create: {
          organizationId,
          ...defaults,
          faq: defaults.faq.map((f) => ({ question: f.question, answer: f.answer })),
          ...stamp,
        },
        update: stamp,
      });
      // SECURITY.md §6: правка — в журнал с автором; сам текст — настройка владельца, в журнал идёт его длина
      await tx.auditLog.create({
        data: {
          userId: userId ?? auditUserId(),
          entityType: 'SellerProfile',
          entityId: organizationId,
          action: 'seller.prompt.updated',
          after: { length: text.length },
        },
      });
      return rowOf(saved as ProfileRecord);
    });
  }

  async markProfileApplied(organizationId: string, version: Date): Promise<void> {
    await this.prisma.db.sellerProfile.updateMany({
      where: { organizationId },
      data: { profileAppliedAt: version },
    });
  }

  async markFactsApplied(organizationId: string, hash: string, at: Date): Promise<void> {
    await this.prisma.db.sellerProfile.updateMany({
      where: { organizationId },
      data: { factsHash: hash, factsAppliedAt: at },
    });
  }

  async markError(organizationId: string, message: string, at: Date): Promise<void> {
    await this.prisma.db.sellerProfile.updateMany({
      where: { organizationId },
      data: { lastError: message.slice(0, 500), lastErrorAt: at },
    });
  }

  async clearError(organizationId: string): Promise<void> {
    await this.prisma.db.sellerProfile.updateMany({
      where: { organizationId },
      data: { lastError: null, lastErrorAt: null },
    });
  }
}

/**
 * Факты объекта (ТЗ П8): карточка объекта организации, активные категории с числом активных мест, тариф виджета
 * бронирования на сайте и его цены в окне. Объект — по организации напрямую, а не по имени: служба сверки ходит
 * без человека, и чужой объект сюда не попадёт.
 */
@Injectable()
export class PrismaSellerFactsRepository implements SellerFactsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async load(organizationId: string, now: Date): Promise<SellerFactsSource | null> {
    const db = this.prisma.db;
    const property = await db.property.findFirst({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        address: true,
        timezone: true,
        currency: true,
        checkInTime: true,
        checkOutTime: true,
      },
    });
    if (!property) return null;
    const window = sellerFactsWindow(now, property.timezone);

    const types = await db.accommodationType.findMany({
      where: { propertyId: property.id, active: true },
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        kind: true,
        capacityAdults: true,
        _count: { select: { units: { where: { active: true } } } },
      },
    });
    const site = await db.trackedSite.findFirst({
      where: {
        propertyId: property.id,
        status: 'ACTIVE',
        bookingEnabled: true,
        bookingRatePlanId: { not: null },
      },
      orderBy: { createdAt: 'asc' },
      select: { bookingRatePlan: { select: { id: true, code: true, name: true, currency: true } } },
    });
    const plan = site?.bookingRatePlan ?? null;
    const codeOf = new Map(types.map((t) => [t.id, t.code]));
    const rates = plan
      ? await db.dailyRate.findMany({
          where: {
            ratePlanId: plan.id,
            accommodationTypeId: { in: types.map((t) => t.id) },
            date: {
              gte: new Date(`${window.from}T00:00:00Z`),
              lte: new Date(`${window.to}T00:00:00Z`),
            },
          },
          select: { date: true, accommodationTypeId: true, occupancy: true, price: true },
        })
      : [];

    return {
      property: {
        name: property.name,
        address: property.address,
        timezone: property.timezone,
        currency: property.currency,
        checkInTime: property.checkInTime,
        checkOutTime: property.checkOutTime,
      },
      categories: types.map((t) => ({
        code: t.code,
        name: t.name,
        kind: t.kind,
        capacityAdults: t.capacityAdults,
        units: t._count.units,
      })),
      // цены — в единицах тарифа сайта (у тарифа «ОТА в USD» — центы), и валюта уходит его
      ratePlan: plan ? { code: plan.code, name: plan.name, currency: plan.currency } : null,
      rates: rates.map((r) => ({
        categoryCode: codeOf.get(r.accommodationTypeId)!,
        date: r.date.toISOString().slice(0, 10),
        occupancy: r.occupancy,
        priceMinor: r.price,
      })),
      window,
    };
  }
}

@Injectable()
export class PrismaSellerOrgsRepository implements SellerOrgsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async withExtension(): Promise<SellerOrganizationRow[]> {
    const rows = await this.prisma.db.organizationExtension.findMany({
      where: { extension: 'AI_SELLER' },
      select: { organizationId: true, organization: { select: { name: true } } },
      orderBy: { organizationId: 'asc' },
    });
    return rows.map((r) => ({ organizationId: r.organizationId, name: r.organization.name }));
  }

  async one(organizationId: string): Promise<SellerOrganizationRow | null> {
    const row = await this.prisma.db.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true },
    });
    return row ? { organizationId: row.id, name: row.name } : null;
  }

  async hosts(organizationId: string): Promise<string[]> {
    const sites = await this.prisma.db.trackedSite.findMany({
      where: { property: { organizationId }, status: 'ACTIVE' },
      select: { hosts: true },
      orderBy: { createdAt: 'asc' },
    });
    // Свои домены без повторов, в порядке сайтов: их сравнивает дверь виджета продавца
    return [...new Set(sites.flatMap((s) => s.hosts))];
  }
}

/** Запись журнала раздела — общая для обоих ботов (`bots/audit.ts`) */
export { PrismaBotAudit as PrismaSellerAudit } from '../bots/audit';

@Injectable()
export class PrismaSellerCatalogRepository implements SellerCatalogRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async placement(organizationId: string): Promise<SellerCatalogPlacement | null> {
    const property = await this.prisma.db.property.findFirst({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
      select: {
        location: {
          select: { id: true, name: true, business: { select: { id: true, name: true } } },
        },
      },
    });
    const location = property?.location;
    if (!location) return null;
    return {
      business: { id: location.business.id, name: location.business.name },
      location: { id: location.id, name: location.name },
    };
  }

  async drafts(organizationId: string, limit: number): Promise<SellerCatalogDraft[]> {
    return this.prisma.db.sellerAgent.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, name: true, updatedAt: true },
    });
  }
}
