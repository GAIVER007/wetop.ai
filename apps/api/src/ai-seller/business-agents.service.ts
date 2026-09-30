import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AGENT_SETUP_ITEMS,
  createAgentAvailability,
  parseAgentInput,
  type AgentSetupItem,
  type CreateAgentAvailability,
} from '@pms/domain';
import {
  actorMay,
  currentBusinessId,
  currentLocationId,
  currentOrganizationId,
  currentScope,
  currentUserId,
  hasSignedInActor,
} from '../auth/request-context';
import { ExtensionsService, type AiSellerAccessView } from '../platform/extensions.service';
import {
  BUSINESS_AGENTS,
  ForeignIdempotencyKeyError,
  LocationTakenError,
  type BusinessAgentsRepository,
} from './business-agents.repository';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const AGENT_LOCATION_TAKEN = 'Нет свободного филиала. Для этого филиала AI-продавец уже создан.';

export interface AgentOptionsView {
  extension: AiSellerAccessView;
  /** Может ли вошедший создать агента сейчас; причина — словами, когда нет. Считает сервер, страница не пересчитывает */
  canCreate: boolean;
  reason: string | null;
  businesses: Array<{
    id: string;
    name: string;
    locations: Array<{ id: string; name: string; free: boolean; reason: string | null }>;
  }>;
}

export interface BusinessAgentView {
  id: string;
  name: string;
  lifecycle: string;
  business: { id: string; name: string };
  location: { id: string; name: string };
  setup: readonly AgentSetupItem[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Создание и чтение AI-продавцов-черновиков (SA2). Сервер сам называет всё, что важно: организацию и автора берёт из
 * вошедшего (тело запроса их не несёт), право, расширение, принадлежность филиала и «один неархивный AI-продавец на
 * филиал» проверяет здесь. Запрет записи в режиме «только чтение» ставит `SessionGuard` до контроллера.
 */
@Injectable()
export class BusinessAgentsService {
  constructor(
    @Inject(BUSINESS_AGENTS) private readonly repo: BusinessAgentsRepository,
    @Inject(ExtensionsService) private readonly extensions: ExtensionsService,
  ) {}

  private actor(): { organizationId: string; userId: string } {
    const organizationId = currentOrganizationId();
    const userId = currentUserId();
    if (!hasSignedInActor() || !organizationId || !userId) throw new UnauthorizedException('Войдите в систему');
    return { organizationId, userId };
  }

  /** Scope вошедшего не шире выбора: выбран филиал или Business — за их пределами агента не создать и не увидеть */
  private inScope(businessId: string, locationId: string): boolean {
    const scope = currentScope();
    if (scope === 'LOCATION') return currentLocationId() === locationId;
    if (scope === 'BUSINESS') return currentBusinessId() === businessId;
    return true;
  }

  /** Business и филиалы, которые вошедший видит: организация, действующие, в пределах его выбора */
  private async visible(organizationId: string, access: AiSellerAccessView['access']) {
    // без расширения ничего не читаем: ни Business, ни филиалов
    const rows = access === 'off' ? [] : await this.repo.options(organizationId);
    return rows
      .map((b) => ({
        id: b.id,
        name: b.name,
        locations: b.locations
          .filter((l) => this.inScope(b.id, l.id))
          .map((l) => ({
            id: l.id,
            name: l.name,
            free: !l.taken,
            reason: l.taken ? 'Для этого филиала AI-продавец уже создан.' : null,
          })),
      }))
      .filter((b) => b.locations.length > 0);
  }

  private availabilityOf(access: AiSellerAccessView['access'], businesses: Awaited<ReturnType<BusinessAgentsService['visible']>>) {
    const all = businesses.flatMap((b) => b.locations);
    return createAgentAvailability({
      extension: access,
      canManage: actorMay('seller'),
      locations: { total: all.length, free: all.filter((l) => l.free).length },
    });
  }

  /** Состояние кнопки «+ Подключить AI-продавца» для каталога: то же правило, что у создания, считает сервер */
  async availability(access: AiSellerAccessView['access']): Promise<CreateAgentAvailability> {
    const { organizationId } = this.actor();
    return this.availabilityOf(access, await this.visible(organizationId, access));
  }

  async options(now: Date = new Date()): Promise<AgentOptionsView> {
    const { organizationId } = this.actor();
    const extension = await this.extensions.aiSeller(organizationId, now);
    const businesses = await this.visible(organizationId, extension.access);
    const availability = this.availabilityOf(extension.access, businesses);
    return { extension, canCreate: availability.enabled, reason: availability.reason, businesses };
  }

  async create(idempotencyKey: string | undefined, body: unknown, now: Date = new Date()): Promise<BusinessAgentView> {
    const { organizationId, userId } = this.actor();
    if (!actorMay('seller')) throw new ForbiddenException('Создавать агентов могут владелец и управляющий.');
    if (!idempotencyKey || !UUID.test(idempotencyKey)) throw new BadRequestException('Обновите форму и повторите.');
    const parsed = parseAgentInput(body);
    if (!parsed.ok) throw new BadRequestException({ message: 'Проверьте поля.', errors: parsed.errors });

    const extension = await this.extensions.aiSeller(organizationId, now);
    if (extension.access === 'off') throw new ForbiddenException('Расширение «ИИ-продавец» не подключено.');
    if (extension.access === 'expired') throw new ForbiddenException('Срок расширения «ИИ-продавец» вышел.');

    const { name, businessId, locationId } = parsed.value;
    // чужой, архивный, не того Business и вне выбора вошедшего — одинаково «не найден»: чужому не подтверждаем
    if (!this.inScope(businessId, locationId)) throw new NotFoundException('Филиал не найден');
    const placement = await this.repo.placement(organizationId, businessId, locationId);
    if (!placement) throw new NotFoundException('Филиал не найден');

    try {
      const { agent } = await this.repo.create({ id: idempotencyKey.toLowerCase(), organizationId, userId, name, businessId, locationId });
      return view(agent);
    } catch (error) {
      if (error instanceof LocationTakenError) throw new ConflictException(AGENT_LOCATION_TAKEN);
      if (error instanceof ForeignIdempotencyKeyError) throw new NotFoundException('Агент не найден');
      throw error;
    }
  }

  async get(id: string): Promise<BusinessAgentView> {
    const { organizationId } = this.actor();
    if (!UUID.test(id)) throw new NotFoundException('Агент не найден');
    const agent = await this.repo.get(organizationId, id.toLowerCase());
    if (!agent || !this.inScope(agent.business.id, agent.location.id)) throw new NotFoundException('Агент не найден');
    return view(agent);
  }
}

function view(agent: {
  id: string;
  name: string;
  lifecycle: string;
  business: { id: string; name: string };
  location: { id: string; name: string };
  createdAt: Date;
  updatedAt: Date;
}): BusinessAgentView {
  return {
    id: agent.id,
    name: agent.name,
    lifecycle: agent.lifecycle,
    business: agent.business,
    location: agent.location,
    setup: AGENT_SETUP_ITEMS,
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
  };
}
