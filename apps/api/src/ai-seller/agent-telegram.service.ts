import 'reflect-metadata';
import { BadRequestException, ForbiddenException, HttpException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { actorMay, currentOrganizationId, currentUserId } from '../auth/request-context';
import { ExtensionsService } from '../platform/extensions.service';
import { workingSellerScope } from './seller.repository';
import { RateWindows } from '../rate-window';
import { BusinessAgentsService } from './business-agents.service';
import { SELLER_CONNECTION, type SellerConnection } from './seller.connection';
export type TelegramAction = 'status' | 'check' | 'connect' | 'disconnect';
const object = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
@Injectable()
export class AgentTelegramService {
  private readonly limits = new RateWindows(60_000, 10_000);
  constructor(
    @Inject(BusinessAgentsService) private readonly agents: BusinessAgentsService,
    @Inject(ExtensionsService) private readonly extensions: ExtensionsService,
    @Inject(SELLER_CONNECTION) private readonly connection: SellerConnection,
  ) {}
  async run(id: string, action: TelegramAction, input?: unknown) {
    if (!actorMay('seller')) throw new ForbiddenException('Подключением управляют владелец и управляющий.');
    const org = currentOrganizationId();
    if (!org) throw new ForbiddenException('Войдите в организацию.');
    const agent = id === 'working' ? {id: workingSellerScope(org).agentId, lifecycle: 'active'} : await this.agents.get(id);
    const access = (await this.extensions.aiSeller(org)).access;
    if (access === 'off' || (action !== 'status' && (access === 'expired' || agent.lifecycle === 'archived')))
      throw new ForbiddenException('Для подключения нужен действующий ИИ-продавец.');
    if (!this.limits.allow(`${org}:${currentUserId()}`, 20, new Date())) throw new HttpException('Слишком много запросов. Повторите через минуту.', 429);
    const raw = object(input);
    let body: Record<string, unknown> = {};
    if (action === 'check' || action === 'connect') {
      if (typeof raw.token !== 'string' || !/^[0-9]{5,20}:[A-Za-z0-9_-]{20,200}$/.test(raw.token.trim()))
        throw new BadRequestException('Введите токен бота из BotFather.');
      body = { token: raw.token.trim() };
      if (action === 'connect') {
        const ids = raw.allowedUserIds;
        if (!Array.isArray(ids) || !ids.length || ids.length > 20 || ids.some(v => typeof v !== 'string' || !/^[1-9][0-9]{0,19}$/.test(v)))
          throw new BadRequestException('Укажите Telegram ID тестировщиков, только цифры.');
        body.allowed_user_ids = [...new Set(ids)];
      }
    }
    const client = this.connection.client(org, agent.id);
    if (!client) throw new ServiceUnavailableException('Сервис ИИ-продавца пока недоступен.');
    let result: Record<string, unknown>;
    try { result = object(await client.telegram(org, action, body)); }
    catch { throw new ServiceUnavailableException('Подключение Telegram недоступно. Проверьте готовность сервера и токен; настройки не подтверждены.'); }
    // Explicit allowlist prevents provider credentials leaking through the proxy.
    const keys = action === 'check' ? ['valid','username','conflict'] : ['set','state','username','allowedUserIds','lastReceivedAt','lastSentAt','error'];
    return Object.fromEntries(keys.filter(key => key in result).map(key => [key, result[key]]));
  }
}
