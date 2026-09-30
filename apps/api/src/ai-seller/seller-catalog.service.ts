import 'reflect-metadata';
import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { agentStatus, type AgentStatus, type ChannelState, type CreateAgentAvailability } from '@pms/domain';
import {
  actorMay,
  currentOrganizationId,
  hasSignedInActor,
} from '../auth/request-context';
import { ExtensionsService, type AiSellerAccessView } from '../platform/extensions.service';
import { BusinessAgentsService } from './business-agents.service';
import { SELLER_CONNECTION, type SellerConnection } from './seller.connection';
import {
  SELLER_CATALOG,
  SELLER_ORGS,
  SELLER_PROFILES,
  type SellerCatalogRepository,
  type SellerOrgsRepository,
  type SellerProfilesRepository,
} from './seller.repository';
import { SELLER_NO_ORGANIZATION, profileApplied } from './seller.service';

/** Не больше карточек-черновиков на страницу: гостевой мастер их не ограничивает, страница не должна расти без конца */
export const CATALOG_DRAFTS_MAX = 50;
/** Бот отвечает медленно или молчит — страница не ждёт дольше: канал показывается как «нет данных» */
export const CATALOG_BOT_TIMEOUT_MS = 1_500;
export const SELLER_AGENT_DEFAULT_NAME = 'AI-продавец';

export interface AgentCardView {
  /** `seller` — рабочий продавец организации; иначе — id записи `seller_agents` */
  id: string;
  /** `seller` — рабочий продавец; `agent` — агент с филиалом (SA2); `draft` — черновик гостевого мастера без филиала */
  kind: 'seller' | 'agent' | 'draft';
  name: string;
  status: AgentStatus;
  business: { id: string; name: string } | null;
  location: { id: string; name: string } | null;
  /** У черновика каналов нет: продавец по нему не запущен */
  channels: { site: ChannelState; whatsapp: ChannelState } | null;
}

export interface AgentCatalogView {
  extension: AiSellerAccessView | null;
  /** Владелец и управляющий (ADR-107): им доступны кнопки; сотрудник смены список видит без них */
  canManage: boolean;
  /** Может менять настройки сейчас: управляющая роль и действующее расширение */
  canConfigure: boolean;
  /** Состояние кнопки «+ Подключить AI-продавца»: причина словами, когда неактивна. Считает сервер (SA2) */
  create: CreateAgentAvailability;
  agents: AgentCardView[];
}

/**
 * Каталог Business Agents (SA1, plans/business-ai-seller-v2-2026-09-29.md §8): только чтение. Организация — из сессии
 * вошедшего, чужих строк здесь нет. Ни схема, ни бот, ни права не менялись: карточка собирается из расширения, профиля
 * продавца, объекта организации, доменов её сайтов и черновиков гостевого мастера.
 */
@Injectable()
export class SellerCatalogService {
  constructor(
    @Inject(SELLER_CONNECTION) private readonly connection: SellerConnection,
    @Inject(SELLER_PROFILES) private readonly profiles: SellerProfilesRepository,
    @Inject(SELLER_ORGS) private readonly orgs: SellerOrgsRepository,
    @Inject(SELLER_CATALOG) private readonly catalog: SellerCatalogRepository,
    @Inject(ExtensionsService) private readonly extensions: ExtensionsService,
    @Inject(BusinessAgentsService) private readonly businessAgents: BusinessAgentsService,
  ) {}

  async list(now: Date = new Date()): Promise<AgentCatalogView> {
    if (!hasSignedInActor()) throw new BadRequestException(SELLER_NO_ORGANIZATION);
    const organizationId = currentOrganizationId();
    if (!organizationId) throw new ForbiddenException(SELLER_NO_ORGANIZATION);
    const extension = await this.extensions.aiSeller(organizationId, now);
    const access = extension.access;
    const canManage = actorMay('seller');
    const create = await this.businessAgents.availability(access);
    const view = { extension, canManage, canConfigure: canManage && access === 'active', create };
    // без расширения продавца не трогаем: ни объекта, ни бота, ни черновиков (план §8.1, C8)
    if (access === 'off') return { ...view, agents: [] };

    const config = this.connection.config();
    const connection = !config.baseUrl || !config.serviceKey ? 'not-configured' : 'ready';
    const [row, placement, hosts, drafts, whatsapp] = await Promise.all([
      this.profiles.get(organizationId),
      this.catalog.placement(organizationId),
      this.orgs.hosts(organizationId),
      this.catalog.drafts(organizationId, CATALOG_DRAFTS_MAX),
      connection === 'ready'
        ? this.whatsappState(organizationId)
        : Promise.resolve<ChannelState>('UNKNOWN'),
    ]);
    const status = agentStatus({
      extension: access,
      connection,
      profileApplied: row !== null && profileApplied(row),
    });
    const seller: AgentCardView = {
      id: 'seller',
      kind: 'seller',
      name: row?.botName?.trim() || SELLER_AGENT_DEFAULT_NAME,
      // `off` отсеян выше, статус здесь всегда есть
      status: status ?? 'NOT_CONFIGURED',
      business: placement?.business ?? null,
      location: placement?.location ?? null,
      channels: { site: hosts.length > 0 ? 'ON' : 'OFF', whatsapp },
    };
    return {
      ...view,
      agents: [
        seller,
        ...drafts.map(
          (d): AgentCardView => ({
            id: d.id,
            kind: d.placement ? 'agent' : 'draft',
            name: d.name,
            status: 'DRAFT',
            business: d.placement?.business ?? null,
            location: d.placement?.location ?? null,
            channels: null,
          }),
        ),
      ],
    };
  }

  /** Подключён ли WhatsApp — по ответу бота; не ответил вовремя или упал — «нет данных», а не ошибка страницы */
  private async whatsappState(organizationId: string): Promise<ChannelState> {
    const client = this.connection.client(organizationId);
    if (!client) return 'UNKNOWN';
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const answer = await Promise.race([
        client.whatsappStatus(organizationId),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('timeout')), CATALOG_BOT_TIMEOUT_MS);
        }),
      ]);
      const set = (answer as { set?: unknown } | null)?.set;
      return set === true ? 'ON' : 'OFF';
    } catch {
      return 'UNKNOWN';
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
