import 'reflect-metadata';
import { Controller, Get, Inject, Injectable, UseInterceptors } from '@nestjs/common';
import { ChannelOperatorInterceptor } from './operator-access';
import { channex } from '@pms/integrations';
import { CHANNELS_REPOSITORY, type ChannelsRepository } from './channels.repository';
import { PROVIDER } from './ari-publisher';

export const CHANNEL_CONNECTION_READER = Symbol('CHANNEL_CONNECTION_READER');
type Reader = Pick<channex.ChannexClient, 'getProperty'>;
/** Dedicated bounded GET client; opening diagnostics never triggers sync, pull or acknowledgement. */
export function connectionReaderFromEnv(): Reader | null {
  const apiKey = process.env.CHANNEX_API_KEY?.trim();
  if (!apiKey) return null;
  return new channex.ChannexClient({
    apiKey,
    baseUrl: process.env.CHANNEX_API_BASE_URL?.trim() || channex.CHANNEX_STAGING_URL,
    allowProduction: channex.channexProductionAllowed(),
    maxRetries: 0,
    fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(8000) }),
  });
}

@Injectable()
export class ChannelConnectionService {
  constructor(
    @Inject(CHANNELS_REPOSITORY) private readonly repo: ChannelsRepository,
    @Inject(CHANNEL_CONNECTION_READER) private readonly reader: Reader | null,
  ) {}

  async status() {
    const [mapping, lastWebhookAt, lastPullAt] = await Promise.all([
      this.repo.mappings(PROVIDER),
      this.repo.lastEventAt(PROVIDER, 'WEBHOOK'),
      this.repo.lastEventAt(PROVIDER, 'PULL'),
    ]);
    const base = process.env.CHANNEX_API_BASE_URL?.trim() || channex.CHANNEX_STAGING_URL;
    let host = '';
    try {
      host = new URL(base).hostname;
    } catch {
      /* invalid configuration stays unknown */
    }
    const environment =
      host === 'staging.channex.io'
        ? 'staging'
        : host === 'app.channex.io' || host === 'api.channex.io'
          ? 'production'
          : 'custom';
    const propertyId = mapping.find((m) => m.providerPropertyId)?.providerPropertyId ?? null;
    const result = {
      checkedAt: new Date().toISOString(),
      environment,
      apiConfigured: !!this.reader,
      propertyId,
      propertyAccessible: false,
      mappedCategories: new Set(mapping.map((m) => m.providerRoomTypeId).filter(Boolean)).size,
      mappedRatePlans: new Set(mapping.map((m) => m.providerRatePlanId).filter(Boolean)).size,
      lastWebhookAt: lastWebhookAt?.toISOString() ?? null,
      lastPullAt: lastPullAt?.toISOString() ?? null,
    };
    if (!this.reader) return { ...result, state: 'NO_KEY', message: 'Не задан ключ Channex' };
    if (!propertyId) return { ...result, state: 'NO_MAPPING', message: 'Объект не сопоставлен' };
    const configuredId = process.env.CHANNEX_PROPERTY_ID?.trim();
    if (configuredId && configuredId !== propertyId)
      return {
        ...result,
        state: 'MAPPING_MISMATCH',
        message: 'Идентификаторы объекта не совпадают',
      };
    try {
      await this.reader.getProperty(propertyId);
      return { ...result, state: 'READY', propertyAccessible: true, message: 'Объект доступен' };
    } catch (error) {
      const status = error instanceof channex.ChannexApiError ? error.status : 0;
      const state =
        status === 401 || status === 403
          ? 'DENIED'
          : status === 404
            ? 'NOT_FOUND'
            : status === 429
              ? 'RATE_LIMITED'
              : 'UNREACHABLE';
      const messages = {
        DENIED: 'Нет доступа к объекту',
        NOT_FOUND: 'Объект не найден',
        RATE_LIMITED: 'Лимит запросов Channex',
        UNREACHABLE: 'Channex не отвечает',
      };
      return { ...result, state, message: messages[state] };
    }
  }
}

@Controller('channels/channex')
// только организация подключённого объекта и главный администратор (аудит 26.09, В-2 и С-3; ADR-095)
@UseInterceptors(ChannelOperatorInterceptor)
export class ChannelConnectionController {
  constructor(
    @Inject(ChannelConnectionService) private readonly service: ChannelConnectionService,
  ) {}
  @Get('connection') status() {
    return this.service.status();
  }
}
