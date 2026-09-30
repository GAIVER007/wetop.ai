import 'reflect-metadata';
import { BadRequestException, ForbiddenException, HttpException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { actorMay, currentOrganizationId, currentUserId } from '../auth/request-context';
import { ExtensionsService } from '../platform/extensions.service';
import { RateWindows } from '../rate-window';
import { BusinessAgentsService } from './business-agents.service';
import { SELLER_PROFILES, type SellerProfilesRepository } from './seller.repository';
import { SELLER_CONNECTION, type SellerConnection } from './seller.connection';

const MAX = 20_000;
const textOf = (v: unknown) => typeof v === 'string' ? v.trim() : '';
const objectOf = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};

/** Инструкция черновика: запись в PMS не включает агента и не меняет рабочего продавца. */
@Injectable()
export class AgentInstructionsService {
  private readonly limits = new RateWindows(60 * 60_000, 10_000);
  constructor(
    @Inject(BusinessAgentsService) private readonly agents: BusinessAgentsService,
    @Inject(SELLER_PROFILES) private readonly profiles: SellerProfilesRepository,
    @Inject(ExtensionsService) private readonly extensions: ExtensionsService,
    @Inject(SELLER_CONNECTION) private readonly connection: SellerConnection,
  ) {}

  private async scope(id: string, write: boolean) {
    // get проверяет signed actor, organization и выбранный Business/филиал до обращения к профилю.
    const agent = await this.agents.get(id);
    if (!actorMay('seller')) throw new ForbiddenException('Инструкцию меняют владелец и управляющий.');
    const organizationId = currentOrganizationId()!;
    const extension = await this.extensions.aiSeller(organizationId);
    if (extension.access === 'off' || (write && extension.access === 'expired'))
      throw new ForbiddenException('Для изменения инструкции нужно действующее расширение «ИИ-продавец».');
    if (write && agent.lifecycle === 'archived') throw new ForbiddenException('Агент архивирован.');
    return { agentId: agent.id, organizationId };
  }

  async get(id: string) {
    const scope = await this.scope(id, false);
    return this.read(scope.agentId);
  }

  private async read(id: string) {
    const row = await this.profiles.get(id);
    return { text: row?.promptText ?? '', saved: !!row?.promptText, updatedAt: row?.updatedAt.toISOString() ?? null };
  }

  async save(id: string, raw: unknown) {
    const scope = await this.scope(id, true);
    const text = textOf(raw);
    if (!text || text.length > MAX) throw new BadRequestException(`Введите инструкцию от 1 до ${MAX} знаков.`);
    await this.profiles.savePrompt(scope, text, currentUserId(), new Date());
    return this.read(scope.agentId);
  }

  async generate(id: string, raw: unknown, now = new Date()) {
    const scope = await this.scope(id, true);
    const story = textOf(raw);
    if (story.length < 10 || story.length > 4000) throw new BadRequestException('Рассказ должен содержать от 10 до 4000 знаков.');
    if (!this.limits.allow(`${scope.organizationId}:${currentUserId()}`, 10, now))
      throw new HttpException('Лимит генерации за час исчерпан. Попробуйте позже.', 429);
    // Генерация — org-scoped операция подготовки текста, не чат рабочего агента.
    const client = this.connection.client(scope.organizationId);
    if (!client) throw new ServiceUnavailableException('Генерация пока недоступна. Инструкцию можно написать вручную.');
    let body: Record<string, unknown>;
    try { body = objectOf(await client.generateInstruction(story)); }
    catch { throw new ServiceUnavailableException('Не удалось подготовить инструкцию. Текст рассказа остался на экране; попробуйте позже.'); }
    const text = textOf(body.text);
    if (text.length < 10 || text.length > MAX) throw new ServiceUnavailableException('Не удалось подготовить корректную инструкцию. Попробуйте ещё раз.');
    const warnings = Array.isArray(body.warnings) ? body.warnings.map(textOf).filter(Boolean).slice(0, 10) : [];
    return { text, warnings };
  }
}
