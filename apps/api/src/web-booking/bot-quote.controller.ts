import 'reflect-metadata';
import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Inject,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { serviceKeyKind } from '../auth/auth.guard';
import { Public } from '../auth/public.decorator';
import { WebBookingService, type Quote } from './web-booking.service';

export const QUOTE_KEY_REQUIRED = 'Котировку читает только продавец по своему ключу';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Котировка для ИИ-продавца (Q-166 в объёме чтения — ADR-085; план `plans/seller-quotes-2026-09-25.md`).
 *
 * Один адрес, только GET, узкий ключ `SELLER_QUOTE_KEY` в `x-wetop-service-key` — тот же образец, что
 * `GET /assistant/errors` (ADR-067, ADR-079): маршрут @Public, ключ контроллер сверяет сам — замок молчит
 * без `AUTH_REQUIRED=1`; при включённом замке та же пара «вид ключа + список из одного адреса» живёт
 * в `SessionGuard`. Домены не проверяются: запрос серверный, не из браузера; публичный `/w/availability`
 * не ослабляется. Брони этой дверью нет и не будет — она остаётся заявкой администратору до базы в РК
 * (Q-166б, ADR-086).
 */
@Public()
@Controller('bot')
export class BotQuoteController {
  constructor(@Inject(WebBookingService) private readonly service: WebBookingService) {}

  @Get('availability')
  @Header('Cache-Control', 'no-store')
  async availability(
    @Req() request: { headers: Record<string, unknown> },
    @Query() query: Record<string, string>,
  ): Promise<Quote> {
    this.checkKey(request);
    // `agent` — недоверенный селектор: по нему находится строка агента, организация и филиал берутся из неё (SA2.5).
    // Организация при этом не читается вовсе. Только `organization` — прежний бот; двух агентов он не различает (сервис).
    if (query.agent !== undefined) {
      const agent = query.agent;
      if (!UUID.test(agent)) throw new BadRequestException('agent: ожидается UUID');
      return this.service.quoteForAgent(agent.toLowerCase(), query);
    }
    const organization = query.organization ?? '';
    if (!UUID.test(organization)) throw new BadRequestException('organization: ожидается UUID');
    return this.service.quoteForOrganization(organization.toLowerCase(), query);
  }

  /**
   * Домены виджета агента (SA2.5, Q-SA-17): allowlist вычисляется из действующих сайтов его филиала во время запроса.
   * Копии доменов в агенте нет; бот кэширует ответ на минуты, платформа отвечает всегда свежим.
   */
  @Get('agent-origins')
  @Header('Cache-Control', 'no-store')
  async agentOrigins(
    @Req() request: { headers: Record<string, unknown> },
    @Query() query: Record<string, string>,
  ): Promise<{ hosts: string[] }> {
    this.checkKey(request);
    const agent = query.agent ?? '';
    if (!UUID.test(agent)) throw new BadRequestException('agent: ожидается UUID');
    return { hosts: await this.service.originsForAgent(agent.toLowerCase()) };
  }

  private checkKey(request: { headers: Record<string, unknown> }): void {
    const key = serviceKeyKind(request.headers);
    if (key === null) throw new UnauthorizedException(QUOTE_KEY_REQUIRED);
    if (key !== 'seller-quote' && key !== 'service') throw new ForbiddenException(QUOTE_KEY_REQUIRED);
  }
}
