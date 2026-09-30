import 'reflect-metadata';
import { Body, Controller, Get, Header, Headers, HttpCode, Inject, Param, Post } from '@nestjs/common';
import { Access } from '../auth/access.decorator';
import { BusinessAgentsService } from './business-agents.service';

/**
 * Business Agents (SA2): создание черновика и страница его состояния. Отдельно от гостевого `/seller-agents`
 * (ADR-127: другой ограниченный контекст). Организацию и автора сервер берёт из вошедшего, тело их не несёт.
 */
@Access('seller')
@Controller('ai-seller/agents')
export class BusinessAgentsController {
  constructor(@Inject(BusinessAgentsService) private readonly agents: BusinessAgentsService) {}

  /** Куда можно создать: Business → филиалы со словом «занят». Читают все роли с диалогами, кнопка — по `canCreate` */
  @Access('dialogs')
  @Get('options')
  @Header('Cache-Control', 'no-store')
  options() {
    return this.agents.options();
  }

  /** Создать черновик. Повтор с тем же `Idempotency-Key` возвращает того же агента */
  @Post()
  @HttpCode(201)
  create(@Headers('idempotency-key') key: string | undefined, @Body() body: unknown) {
    return this.agents.create(key, body);
  }

  @Access('dialogs')
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  get(@Param('id') id: string) {
    return this.agents.get(id);
  }

  /** Всегда 409 до SA9: запрет запуска живёт на сервере */
  @Post(':id/activate')
  @HttpCode(200)
  activate(@Param('id') id: string) {
    return this.agents.activate(id);
  }
}
