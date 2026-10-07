import { Inject, Injectable } from '@nestjs/common';
import {
  buildSiteBrief,
  type BriefCategoryFacts,
  type BriefChannexContent,
  type SiteBrief,
  type SiteBriefSnapshot,
} from '@pms/domain';
import type { DbTx } from '@pms/database';
import { PrismaService } from '../database/prisma.provider';
import { readChannexContent, type ContentReader } from '../channels/content';
import { PROVIDER } from '../channels/ari-publisher';
import { siteScope, siteTransaction, type SiteScope } from './scope';

/**
 * Бриф сайта (MKT5, `docs/marketing/site-brief-v0.md`). Только чтение: одна транзакция базы на снимок филиала, затем,
 * уже после неё, запрос в Channex по id объекта этого филиала. Ничего не пишет, строку `MarketingSite` не читает и не
 * создаёт, модель не зовёт.
 *
 * Выборки берут ровно поля белого списка: колонок инструкции продавца (`prompt_text`, запреты, приветствие и прочее),
 * юридических данных, контактов объекта и любых данных гостей, броней и денег здесь нет даже в памяти.
 */
export const BRIEF_CHANNEX_READER = Symbol('BRIEF_CHANNEX_READER');

const CHANNEX_CACHE_MS = 10 * 60_000;

interface PlatformSnapshot {
  platform: SiteBriefSnapshot['platform'];
  seller: SiteBriefSnapshot['seller'];
  /** Id объекта у провайдера: нужен только для запроса, в бриф не попадает */
  channexPropertyId: string | null;
}

export async function readBriefSnapshot(tx: DbTx, scope: SiteScope): Promise<PlatformSnapshot> {
  const location = await tx.location.findFirstOrThrow({
    where: { id: scope.locationId, businessId: scope.businessId },
    select: { name: true, address: true, phone: true, email: true, timezone: true, currency: true },
  });
  const property = await tx.property.findFirst({
    where: { locationId: scope.locationId, organizationId: scope.organizationId },
    select: {
      id: true,
      name: true,
      address: true,
      city: true,
      countryCode: true,
      channexPropertyType: true,
      timezone: true,
      currency: true,
      checkInTime: true,
      checkOutTime: true,
    },
  });
  let categories: BriefCategoryFacts[] = [];
  let channexPropertyId: string | null = null;
  if (property) {
    const rows = await tx.accommodationType.findMany({
      where: { propertyId: property.id, active: true },
      select: {
        code: true,
        name: true,
        kind: true,
        capacityAdults: true,
        _count: { select: { units: { where: { active: true } } } },
      },
    });
    categories = rows.map((r) => ({
      code: r.code,
      name: r.name,
      kind: r.kind,
      capacityAdults: r.capacityAdults,
      activeUnits: r._count.units,
    }));
    const mapping = await tx.channelMapping.findFirst({
      where: { propertyId: property.id, provider: PROVIDER },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { providerPropertyId: true },
    });
    channexPropertyId = mapping?.providerPropertyId ?? null;
  }
  const agent = await tx.sellerAgent.findFirst({
    where: {
      organizationId: scope.organizationId,
      locationId: scope.locationId,
      scenario: 'sales',
      lifecycle: { not: 'archived' },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      workingProfile: {
        select: { languages: true, includedInPrice: true, extraCharges: true, houseRules: true, faq: true },
      },
    },
  });
  const p = agent?.workingProfile ?? null;
  const seller: SiteBriefSnapshot['seller'] = !agent
    ? { state: 'MISSING', reason: 'NO_AGENT' }
    : !p
      ? { state: 'MISSING', reason: 'NO_PROFILE' }
      : {
          state: 'READY',
          profile: {
            languages: p.languages,
            includedInPrice: p.includedInPrice,
            extraCharges: p.extraCharges,
            houseRules: p.houseRules,
            faq: Array.isArray(p.faq)
              ? (p.faq as unknown[])
                  .filter(
                    (f): f is { question: string; answer: string } =>
                      !!f &&
                      typeof f === 'object' &&
                      typeof (f as Record<string, unknown>)['question'] === 'string' &&
                      typeof (f as Record<string, unknown>)['answer'] === 'string',
                  )
                  .map((f) => ({ question: f.question, answer: f.answer }))
              : [],
          },
        };
  // id объекта нужен только для выборок выше, в снимок он не идёт
  const propertyFacts = property && {
    name: property.name,
    address: property.address,
    city: property.city,
    countryCode: property.countryCode,
    channexPropertyType: property.channexPropertyType,
    timezone: property.timezone,
    currency: property.currency,
    checkInTime: property.checkInTime,
    checkOutTime: property.checkOutTime,
  };
  return {
    platform: { location, property: propertyFacts, categories },
    seller,
    channexPropertyId,
  };
}

@Injectable()
export class SiteBriefService {
  /** Кэш контента Channex по id объекта провайдера: только удачные ответы, 10 минут, `refresh` обходит */
  private readonly cache = new Map<string, { at: number; value: SiteBriefSnapshot['channex'] }>();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(BRIEF_CHANNEX_READER) private readonly reader: ContentReader | null,
  ) {}

  async brief(pointerSent: boolean, refresh: boolean, now = Date.now()): Promise<SiteBrief> {
    return this.briefFor(siteScope(pointerSent), refresh, now);
  }

  /**
   * Бриф филиала по уже проверенному scope: запрос человека (`brief`) и воркер генерации (MKT6), который берёт филиал
   * из строки сайта и пересобирает бриф перед вызовом модели.
   */
  async briefFor(scope: SiteScope, refresh: boolean, now = Date.now()): Promise<SiteBrief> {
    // транзакция закрывается до запроса в Channex: база не ждёт внешний API
    const snap = await siteTransaction(this.prisma, scope, false, (tx) => readBriefSnapshot(tx, scope));
    const channex = await this.channex(snap.channexPropertyId, refresh, now);
    return buildSiteBrief({ platform: snap.platform, seller: snap.seller, channex }, new Date(now).toISOString());
  }

  private async channex(
    propertyId: string | null,
    refresh: boolean,
    now: number,
  ): Promise<SiteBriefSnapshot['channex']> {
    if (!this.reader) return { state: 'NO_KEY', checkedAt: null, content: null };
    if (!propertyId) return { state: 'NO_MAPPING', checkedAt: null, content: null };
    const hit = this.cache.get(propertyId);
    if (!refresh && hit && now - hit.at < CHANNEX_CACHE_MS) return hit.value;
    const read = await readChannexContent(this.reader, propertyId);
    const content: BriefChannexContent | null =
      read.state === 'READY'
        ? {
            property: read.property,
            policy: read.policy,
            facilities: read.facilities.map((f) => ({ title: f.title, category: f.category })),
            // адреса фото в бриф не идут: MKT5 не импортирует медиа
            photos: read.photos.map((ph) => ({ description: ph.description, forRoomType: ph.forRoomType })),
          }
        : null;
    const value: SiteBriefSnapshot['channex'] = { state: read.state, checkedAt: read.checkedAt, content };
    if (read.state === 'READY') this.cache.set(propertyId, { at: now, value });
    return value;
  }
}
