import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import {
  pickSellerProfile,
  sellerFactsWindow,
  type SellerFaqItem,
  type SellerFactsSource,
  type SellerProfileInput,
} from '@pms/domain';
import { auditUserId } from '../accounts/actor';
import { PrismaService } from '../database/prisma.provider';

export const SELLER_PROFILES = Symbol('SELLER_PROFILES');
export const SELLER_FACTS = Symbol('SELLER_FACTS');
export const SELLER_AUDIT = Symbol('SELLER_AUDIT');

/** Строка `seller_profiles` (DATA_MODEL §15): поля «Настроек» плюс отметки доставки продавцу */
export interface SellerProfileRow extends SellerProfileInput {
  organizationId: string;
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
  markProfileApplied(organizationId: string, version: Date): Promise<void>;
  markFactsApplied(organizationId: string, hash: string, at: Date): Promise<void>;
  markError(organizationId: string, message: string, at: Date): Promise<void>;
  clearError(organizationId: string): Promise<void>;
}

export interface SellerFactsRepository {
  /** Факты объекта организации; `null` — объекта у организации нет */
  load(organizationId: string, now: Date): Promise<SellerFactsSource | null>;
}

/** Действия сотрудника в разделе, которые продавец сам записать не может: он видит только ключ платформы */
export interface SellerAudit {
  record(event: {
    entityType: string;
    entityId: string;
    action: string;
    after: Record<string, unknown>;
  }): Promise<void>;
}

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
  addressForm: 'FORMAL' | 'INFORMAL';
  useEmoji: boolean;
  replyLength: 'SHORT' | 'MEDIUM' | 'LONG';
  languages: string[];
  greeting: string;
  includedInPrice: string;
  paidExtras: string;
  houseRules: string;
  prohibitions: string;
  handoffRules: string;
  faq: unknown;
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
  useEmoji: r.useEmoji,
  replyLength: r.replyLength,
  languages: r.languages,
  greeting: r.greeting,
  includedInPrice: r.includedInPrice,
  paidExtras: r.paidExtras,
  houseRules: r.houseRules,
  prohibitions: r.prohibitions,
  handoffRules: r.handoffRules,
  faq: faqOf(r.faq),
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
            ? { before: JSON.parse(JSON.stringify(pickSellerProfile(rowOf(before as ProfileRecord)))) }
            : {}),
          after: JSON.parse(JSON.stringify(fields)),
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
      select: { bookingRatePlan: { select: { id: true, code: true, name: true } } },
    });
    const plan = site?.bookingRatePlan ?? null;
    const codeOf = new Map(types.map((t) => [t.id, t.code]));
    const rates = plan
      ? await db.dailyRate.findMany({
          where: {
            ratePlanId: plan.id,
            accommodationTypeId: { in: types.map((t) => t.id) },
            date: { gte: new Date(`${window.from}T00:00:00Z`), lte: new Date(`${window.to}T00:00:00Z`) },
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
      ratePlan: plan ? { code: plan.code, name: plan.name } : null,
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
export class PrismaSellerAudit implements SellerAudit {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async record(event: {
    entityType: string;
    entityId: string;
    action: string;
    after: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.db.auditLog.create({
      data: {
        userId: auditUserId(),
        entityType: event.entityType,
        entityId: event.entityId,
        action: event.action,
        after: JSON.parse(JSON.stringify(event.after)),
      },
    });
  }
}
