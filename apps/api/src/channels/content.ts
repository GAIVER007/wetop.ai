import 'reflect-metadata';
import { Controller, Get, Inject, Injectable, Query } from '@nestjs/common';
import { channex } from '@pms/integrations';
import { CHANNELS_REPOSITORY, type ChannelsRepository } from './channels.repository';
import { PROVIDER } from './ari-publisher';

/**
 * Контент объекта для WETOP читается из Channex (ADR-033): описание, контакты, правила объекта, удобства, фото.
 * Только чтение по сохранённой документации (hotels-collection.md, facilities-collection.md,
 * hotel-policy-collection.md, photos-collection.md). Ключи, id провайдера и тела ответов наружу не отдаются.
 */
export const CHANNEL_CONTENT_READER = Symbol('CHANNEL_CONTENT_READER');
export type ContentReader = Pick<
  channex.ChannexClient,
  'getProperty' | 'listPropertyFacilities' | 'listAll'
>;

/** Отдельный клиент только на чтение: без повторов, 10 с на запрос — экран не зависает на Channex */
export function contentReaderFromEnv(): ContentReader | null {
  const apiKey = process.env.CHANNEX_API_KEY?.trim();
  if (!apiKey) return null;
  return new channex.ChannexClient({
    apiKey,
    baseUrl: process.env.CHANNEX_API_BASE_URL?.trim() || channex.CHANNEX_STAGING_URL,
    maxRetries: 0,
    fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(10_000) }),
  });
}

export type ContentState =
  | 'READY'
  | 'NO_KEY'
  | 'NO_MAPPING'
  | 'DENIED'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'UNREACHABLE';
export interface HotelContent {
  checkedAt: string;
  source: 'channex';
  environment: 'staging' | 'production' | 'custom';
  state: ContentState;
  message: string;
  property: {
    title: string | null;
    description: string | null;
    importantInformation: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    address: string | null;
    city: string | null;
    country: string | null;
  } | null;
  policy: {
    checkInTime: string | null;
    checkOutTime: string | null;
    maxGuests: number | null;
    pets: string | null;
    smoking: string | null;
    internet: string | null;
    parking: string | null;
  } | null;
  facilities: Array<{ title: string; category: string | null }>;
  photos: Array<{ url: string; description: string | null; forRoomType: boolean }>;
}

const CACHE_MS = 10 * 60_000;
type Attrs = Record<string, unknown>;
const text = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

export function channexEnvironment(): HotelContent['environment'] {
  const base = process.env.CHANNEX_API_BASE_URL?.trim() || channex.CHANNEX_STAGING_URL;
  let host = '';
  try {
    host = new URL(base).hostname;
  } catch {
    /* неверная настройка — среда неизвестна */
  }
  if (host === 'staging.channex.io') return 'staging';
  return host === 'app.channex.io' || host === 'api.channex.io' ? 'production' : 'custom';
}

@Injectable()
export class ChannelContentService {
  private cache: HotelContent | null = null;
  private cachedAt = 0;

  constructor(
    @Inject(CHANNELS_REPOSITORY) private readonly repo: ChannelsRepository,
    @Inject(CHANNEL_CONTENT_READER) private readonly reader: ContentReader | null,
  ) {}

  async content(refresh = false, now = Date.now()): Promise<HotelContent> {
    if (!refresh && this.cache?.state === 'READY' && now - this.cachedAt < CACHE_MS) return this.cache;
    const result = await this.read();
    if (result.state === 'READY') {
      this.cache = result;
      this.cachedAt = now;
    }
    return result;
  }

  private async read(): Promise<HotelContent> {
    const base: HotelContent = {
      checkedAt: new Date().toISOString(),
      source: 'channex',
      environment: channexEnvironment(),
      state: 'READY',
      message: 'Контент объекта прочитан из Channex',
      property: null,
      policy: null,
      facilities: [],
      photos: [],
    };
    if (!this.reader) return { ...base, state: 'NO_KEY', message: 'Не задан ключ Channex' };
    const propertyId = (await this.repo.mappings(PROVIDER)).find(
      (m) => m.providerPropertyId,
    )?.providerPropertyId;
    if (!propertyId) return { ...base, state: 'NO_MAPPING', message: 'Объект не сопоставлен с Channex' };
    try {
      const filter = { 'filter[property_id]': propertyId };
      const [property, dictionary, policies, photos] = await Promise.all([
        this.reader.getProperty(propertyId),
        this.reader.listPropertyFacilities(),
        this.reader.listAll<Attrs>('/hotel_policies', filter),
        this.reader.listAll<Attrs>('/photos', filter),
      ]);
      const a = property.attributes as Attrs;
      const content = (a['content'] ?? {}) as Attrs;
      const titles = new Map(
        dictionary.map((f) => [
          f.id,
          { title: text(f.attributes['title']) ?? f.id, category: text(f.attributes['category']) },
        ]),
      );
      const selected = Array.isArray(a['facilities']) ? (a['facilities'] as unknown[]) : [];
      const p = (policies[0]?.attributes ?? null) as Attrs | null;
      return {
        ...base,
        property: {
          title: text(a['title']),
          description: text(content['description']),
          importantInformation: text(content['important_information']),
          phone: text(a['phone']),
          email: text(a['email']),
          website: text(a['website']),
          address: text(a['address']),
          city: text(a['city']),
          country: text(a['country']),
        },
        policy: p && {
          checkInTime: text(p['checkin_time']),
          checkOutTime: text(p['checkout_time']),
          maxGuests: typeof p['max_count_of_guests'] === 'number' ? p['max_count_of_guests'] : null,
          pets: text(p['pets_policy']),
          smoking: text(p['smoking_policy']),
          internet: text(p['internet_access_type']),
          parking: text(p['parking_type']),
        },
        facilities: selected
          .map((id) => (typeof id === 'string' ? titles.get(id) : undefined))
          .filter((f): f is { title: string; category: string | null } => !!f)
          .sort((x, y) => (x.category ?? '').localeCompare(y.category ?? '') || x.title.localeCompare(y.title)),
        photos: photos
          .map((ph) => ph.attributes)
          .filter((ph) => typeof ph['url'] === 'string')
          .sort((x, y) => Number(x['position'] ?? 0) - Number(y['position'] ?? 0))
          .map((ph) => ({
            url: ph['url'] as string,
            description: text(ph['description']),
            forRoomType: !!ph['room_type_id'],
          })),
      };
    } catch (error) {
      const status = error instanceof channex.ChannexApiError ? error.status : 0;
      const state: ContentState =
        status === 401 || status === 403
          ? 'DENIED'
          : status === 404
            ? 'NOT_FOUND'
            : status === 429
              ? 'RATE_LIMITED'
              : 'UNREACHABLE';
      const messages: Record<string, string> = {
        DENIED: 'Нет доступа к объекту в Channex',
        NOT_FOUND: 'Объект не найден в Channex',
        RATE_LIMITED: 'Лимит запросов Channex — повторите через минуту',
        UNREACHABLE: 'Channex не отвечает',
      };
      return { ...base, state, message: messages[state]! };
    }
  }
}

@Controller('channels/channex')
export class ChannelContentController {
  constructor(@Inject(ChannelContentService) private readonly service: ChannelContentService) {}
  /** ?refresh=1 — прочитать заново, минуя кэш на 10 минут */
  @Get('content') content(@Query('refresh') refresh?: string) {
    return this.service.content(refresh === '1' || refresh === 'true');
  }
}
