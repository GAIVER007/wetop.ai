import 'reflect-metadata';
import {
  BadGatewayException,
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  HttpCode,
  Inject,
  Injectable,
  Optional,
  Post,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  MarketingBudgetError,
  normalizeAdProposal,
  type AdDestination,
  type AdProposal,
} from '@pms/domain';
import { assistant } from '@pms/integrations';
import { sellerConfigFromEnv } from '../ai-seller/seller.connection';
import { Access } from '../auth/access.decorator';
import {
  currentLocationId,
  currentOrganizationId,
  hasSignedInActor,
} from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';

/**
 * Предложение ИИ-таргетолога (DATA_MODEL §57, ADR-MKT-LAUNCH, контракт `ad-proposal/0`, docs/marketing/ad-proposal-v0.md).
 * Креатив картинками (фото или кадры видео, снятые в браузере), пара фраз об оффере и куда ведёт реклама: бот
 * предлагает текст и аудиторию, домен приводит ответ к правилам. Ничего не создаёт и не тратит: запуск отдельно.
 */
export const AD_PROPOSAL_BOT = Symbol('AD_PROPOSAL_BOT');
export const ADS_LOCATION = Symbol('ADS_LOCATION');

export interface AdProposalBotRequest {
  schemaVersion: 'ad-proposal/0';
  requestId: string;
  creativeKind: 'IMAGE' | 'VIDEO';
  images: Array<{ mediaType: string; dataBase64: string }>;
  offer: string;
  destination: AdDestination;
  business: {
    vertical: string;
    name: string;
    city: string;
    country: string;
    language: 'ru' | 'kk' | 'en';
  };
  /** Прошлые запуски филиала с итогом (появятся с запусками, §57) */
  history: Array<{
    destination: string;
    headline: string;
    ageMin: number;
    ageMax: number;
    spend: string;
    leads: number;
  }>;
  budgetRemainingTokens: number;
}

export interface AdProposalBot {
  /** Ответ бота как есть; разбирает сервис. Нет связи, таймаут, 5xx: `BotUnavailableError` */
  propose(request: AdProposalBotRequest): Promise<unknown>;
}

/** Филиал вошедшего: имя и вертикаль бизнеса для текста */
export interface AdsLocation {
  current(): Promise<{ name: string; vertical: string }>;
}

export function adProposalBotFromEnv(): AdProposalBot | null {
  const config = sellerConfigFromEnv();
  if (!config.baseUrl || !config.serviceKey) return null;
  const client = new assistant.BotPanelClient({
    baseUrl: config.baseUrl,
    serviceKey: config.serviceKey,
  });
  return { propose: (request) => client.adProposal({ ...request }) };
}

@Injectable()
export class PrismaAdsLocation implements AdsLocation {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async current() {
    const organizationId = currentOrganizationId();
    if (!hasSignedInActor() || !organizationId)
      throw new ForbiddenException('Войдите в организацию');
    const locationId = currentLocationId();
    if (!locationId) throw new ConflictException('Выберите филиал');
    const location = await this.prisma.db.location.findFirst({
      where: { id: locationId, status: 'ACTIVE', business: { organizationId } },
      select: { name: true, business: { select: { vertical: true } } },
    });
    if (!location)
      throw new ForbiddenException('Выбранный филиал недоступен: выберите филиал заново');
    return { name: location.name, vertical: location.business.vertical };
  }
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
/** Все картинки вместе: фото до 8 МБ в base64 с запасом; транспортный предел `body-parsers.ts` */
const MAX_BASE64_TOTAL = 11_200_000;
/** Потолок расхода одного предложения; бюджетных таблиц, как у сайта, нет */
const PROPOSAL_BUDGET_TOKENS = 60_000;
const UNAVAILABLE = 'ИИ сейчас недоступен: попробуйте позже или заполните текст и аудиторию руками';
const UNREADABLE = 'ИИ ответил не по делу: попробуйте ещё раз или заполните текст руками';
const LAUNCHABLE: readonly AdDestination[] = ['LEAD_FORM', 'WHATSAPP', 'WEBSITE'];
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

const bad = (msg: string): never => {
  throw new BadRequestException(msg);
};

@Injectable()
export class AdProposalService {
  constructor(
    @Inject(ADS_LOCATION) private readonly location: AdsLocation,
    @Optional() @Inject(AD_PROPOSAL_BOT) private readonly bot: AdProposalBot | null,
  ) {}

  async propose(raw: unknown): Promise<AdProposal> {
    const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const destination = b.destination as AdDestination;
    if (destination === 'MESSENGER' || destination === 'INSTAGRAM_DIRECT')
      bad('Реклама в Messenger и Instagram Direct из WETOP пока не запускается');
    if (!LAUNCHABLE.includes(destination)) bad('Выберите, куда ведёт реклама');
    const creativeKind = b.creativeKind;
    if (creativeKind !== 'IMAGE' && creativeKind !== 'VIDEO') bad('Нужно фото или видео');
    const images = Array.isArray(b.images) ? (b.images as Array<Record<string, unknown>>) : [];
    const [min, max] = creativeKind === 'VIDEO' ? [2, 4] : [1, 1];
    if (images.length < min || images.length > max)
      bad(creativeKind === 'VIDEO' ? 'Для видео нужно 2–4 кадра' : 'Нужно одно фото');
    let total = 0;
    const clean = images.map((i) => {
      const mediaType = typeof i.mediaType === 'string' ? i.mediaType : '';
      const dataBase64 = typeof i.dataBase64 === 'string' ? i.dataBase64 : '';
      if (!IMAGE_TYPES.includes(mediaType)) bad('Картинка: JPG, PNG или WebP');
      if (dataBase64 === '' || dataBase64.length % 4 !== 0 || !BASE64.test(dataBase64))
        bad('Файл не прочитан: загрузите его ещё раз');
      total += dataBase64.length;
      return { mediaType, dataBase64 };
    });
    if (total > MAX_BASE64_TOTAL) bad('Креатив слишком большой: до 8 МБ');
    const offer = typeof b.offer === 'string' ? b.offer.trim() : '';
    if (offer.length > 500) bad('Об оффере коротко: до 500 знаков');
    const city = typeof b.city === 'string' ? b.city.trim() : '';
    if (!city || city.length > 100) bad('Укажите город');
    const country = typeof b.country === 'string' ? b.country : '';
    if (!/^[A-Z]{2}$/.test(country)) bad('Укажите страну');
    if (!this.bot) throw new ServiceUnavailableException(UNAVAILABLE);
    const where = await this.location.current();
    let reply: unknown;
    try {
      reply = await this.bot.propose({
        schemaVersion: 'ad-proposal/0',
        requestId: randomUUID(),
        creativeKind: creativeKind as 'IMAGE' | 'VIDEO',
        images: clean,
        offer,
        destination,
        business: { vertical: where.vertical, name: where.name, city, country, language: 'ru' },
        history: [],
        budgetRemainingTokens: PROPOSAL_BUDGET_TOKENS,
      });
    } catch (error) {
      if (error instanceof assistant.BotUnavailableError)
        throw new ServiceUnavailableException(UNAVAILABLE);
      if (error instanceof assistant.BotRejectedError)
        throw new BadGatewayException(`ИИ отклонил запрос: ${error.detail}`);
      throw error;
    }
    const answer = (reply && typeof reply === 'object' ? reply : {}) as Record<string, unknown>;
    if (answer.status !== 'ok') {
      const code = typeof answer.errorCode === 'string' ? answer.errorCode : '';
      if (code === 'SCHEMA_INVALID' || code === 'REJECTED_CONTENT')
        throw new UnprocessableEntityException(UNREADABLE);
      throw new ServiceUnavailableException(UNAVAILABLE);
    }
    try {
      return normalizeAdProposal(answer.spec, destination);
    } catch (e) {
      if (e instanceof MarketingBudgetError) throw new UnprocessableEntityException(UNREADABLE);
      throw e;
    }
  }
}

/** Предложение готовит запуск рекламы: право запуска (§57), филиал строго из входа */
@Access('ads_launch')
@Controller('marketing/ads')
export class MarketingAdsController {
  constructor(@Inject(AdProposalService) private readonly proposals: AdProposalService) {}

  @Post('proposal')
  @HttpCode(200)
  propose(@Body() body: unknown) {
    return this.proposals.propose(body);
  }
}
