import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import { channex } from '@pms/integrations';
import { LUXX_APARTS_PROPERTY } from '@pms/imports';
import { PrismaService } from '../database/prisma.provider';
import type { LocalDailyRate, LocalRestriction } from './ari';
import type {
  LocalCategoryForChannex,
  LocalPropertyForChannex,
  LocalRatePlanForChannex,
} from './setup-plan';

/** Подмножество клиента Channex, которое нужно синхронизации; в тестах — фальшивка. */
export type ChannexGateway = Pick<
  channex.ChannexClient,
  | 'createProperty'
  | 'createRoomType'
  | 'createRatePlan'
  | 'updateAvailability'
  | 'updateRestrictions'
  | 'listProperties'
  | 'bookingRevisionsFeed'
  | 'getBookingRevision'
  | 'ackBookingRevision'
>;
export const CHANNEX_GATEWAY = Symbol('CHANNEX_GATEWAY');

export interface MappingRow {
  id: string;
  localAccommodationTypeId: string | null;
  localAccommodationTypeCode: string | null;
  localRatePlanId: string | null;
  providerPropertyId: string;
  providerRoomTypeId: string | null;
  providerRatePlanId: string | null;
}
export interface LocalSetup {
  property: LocalPropertyForChannex & { id: string };
  categories: LocalCategoryForChannex[];
  ratePlan: LocalRatePlanForChannex | null;
}

export interface ChannelsRepository {
  localSetup(ratePlanCode: string): Promise<LocalSetup>;
  mappings(provider: string): Promise<MappingRow[]>;
  savePropertyMapping(
    propertyId: string,
    provider: string,
    providerPropertyId: string,
  ): Promise<void>;
  saveRatePlanMapping(row: {
    propertyId: string;
    provider: string;
    localAccommodationTypeId: string;
    localRatePlanId: string;
    providerPropertyId: string;
    providerRoomTypeId: string;
    providerRatePlanId: string;
  }): Promise<void>;
  dailyRates(ratePlanIds: string[], from: string, to: string): Promise<LocalDailyRate[]>;
  restrictions(ratePlanIds: string[], from: string, to: string): Promise<LocalRestriction[]>;
  audit(action: string, after: unknown): Promise<void>;
}
export const CHANNELS_REPOSITORY = Symbol('CHANNELS_REPOSITORY');

/** Адрес объекта для Channex — OBJECT.md (в схеме Property нет страны/города). */
const OBJECT_LOCATION = { country: 'KZ', city: 'Алматы' };
const asDate = (d: string) => new Date(`${d}T00:00:00Z`);
const iso = (x: Date) => x.toISOString().slice(0, 10);

@Injectable()
export class PrismaChannelsRepository implements ChannelsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async localSetup(ratePlanCode: string): Promise<LocalSetup> {
    const p = await this.prisma.db.property.findFirstOrThrow({
      where: { name: LUXX_APARTS_PROPERTY.name },
    });
    const types = await this.prisma.db.accommodationType.findMany({
      where: { propertyId: p.id, active: true },
      orderBy: { code: 'asc' },
      include: { _count: { select: { units: { where: { active: true } } } } },
    });
    const rp = await this.prisma.db.ratePlan.findUnique({
      where: { propertyId_code: { propertyId: p.id, code: ratePlanCode } },
      select: { id: true, code: true, name: true, currency: true },
    });
    return {
      property: {
        id: p.id,
        name: p.name,
        currency: p.currency,
        timezone: p.timezone,
        address: p.address,
        email: null,
        phone: null,
        ...OBJECT_LOCATION,
      },
      categories: types.map((t) => ({
        id: t.id,
        code: t.code,
        name: t.name,
        kind: t.kind,
        capacityAdults: t.capacityAdults,
        units: t._count.units,
      })),
      ratePlan: rp,
    };
  }
  async mappings(provider: string): Promise<MappingRow[]> {
    const rows = await this.prisma.db.channelMapping.findMany({
      where: { provider },
      include: { accommodationType: { select: { code: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      localAccommodationTypeId: r.localAccommodationTypeId,
      localAccommodationTypeCode: r.accommodationType?.code ?? null,
      localRatePlanId: r.localRatePlanId,
      providerPropertyId: r.providerPropertyId,
      providerRoomTypeId: r.providerRoomTypeId,
      providerRatePlanId: r.providerRatePlanId,
    }));
  }
  async savePropertyMapping(
    propertyId: string,
    provider: string,
    providerPropertyId: string,
  ): Promise<void> {
    await this.prisma.db.channelMapping.create({
      data: { propertyId, provider, providerPropertyId },
    });
  }
  async saveRatePlanMapping(
    row: Parameters<ChannelsRepository['saveRatePlanMapping']>[0],
  ): Promise<void> {
    await this.prisma.db.channelMapping.create({ data: row });
  }
  async dailyRates(ratePlanIds: string[], from: string, to: string): Promise<LocalDailyRate[]> {
    const rows = await this.prisma.db.dailyRate.findMany({
      where: { ratePlanId: { in: ratePlanIds }, date: { gte: asDate(from), lte: asDate(to) } },
      include: { accommodationType: { select: { code: true } } },
    });
    return rows.map((r) => ({
      date: iso(r.date),
      accommodationTypeCode: r.accommodationType.code,
      ratePlanId: r.ratePlanId,
      occupancy: r.occupancy,
      priceMinor: r.price,
    }));
  }
  async restrictions(ratePlanIds: string[], from: string, to: string): Promise<LocalRestriction[]> {
    const rows = await this.prisma.db.restriction.findMany({
      where: { ratePlanId: { in: ratePlanIds }, date: { gte: asDate(from), lte: asDate(to) } },
      include: { accommodationType: { select: { code: true } } },
    });
    return rows.map((r) => ({
      date: iso(r.date),
      accommodationTypeCode: r.accommodationType.code,
      ratePlanId: r.ratePlanId,
      minStay: r.minStay,
      maxStay: r.maxStay,
      stopSell: r.stopSell,
      closedToArrival: r.closedToArrival,
      closedToDeparture: r.closedToDeparture,
    }));
  }
  async audit(action: string, after: unknown): Promise<void> {
    const p = await this.prisma.db.property.findFirstOrThrow({
      where: { name: LUXX_APARTS_PROPERTY.name },
      select: { id: true },
    });
    await this.prisma.db.auditLog.create({
      data: {
        entityType: 'Property',
        entityId: p.id,
        action,
        after: JSON.parse(JSON.stringify(after)),
      },
    });
  }
}

/** Клиент Channex из окружения. Без ключа — каждая операция отвечает 503 с понятным текстом. */
export function channexGatewayFromEnv(): ChannexGateway {
  const apiKey = process.env.CHANNEX_API_KEY?.trim();
  const baseUrl = process.env.CHANNEX_API_BASE_URL?.trim() || undefined;
  if (!apiKey) {
    const fail = () =>
      Promise.reject(
        new channex.ChannexApiError(
          'CHANNEX_API_KEY не задан в .env — вписывает владелец (SECURITY.md §3)',
          503,
          '/',
        ),
      );
    return {
      createProperty: fail,
      createRoomType: fail,
      createRatePlan: fail,
      updateAvailability: fail,
      updateRestrictions: fail,
      listProperties: fail,
      bookingRevisionsFeed: fail,
      getBookingRevision: fail,
      ackBookingRevision: fail,
    };
  }
  return new channex.ChannexClient(baseUrl ? { apiKey, baseUrl } : { apiKey });
}
