import 'reflect-metadata';
import { Body, Controller, Get, Header, HttpCode, Inject, Param, Post, Put } from '@nestjs/common';
import { Access } from '../auth/access.decorator';
import { AgentTelegramService } from './agent-telegram.service';
@Access('seller')
@Controller('ai-seller/agents/:id/telegram')
export class AgentTelegramController {
  constructor(@Inject(AgentTelegramService) private readonly service: AgentTelegramService) {}
  @Get() @Header('Cache-Control', 'no-store')
  status(@Param('id') id: string) { return this.service.run(id, 'status'); }
  @Post('check') @HttpCode(200)
  check(@Param('id') id: string, @Body() body: unknown) { return this.service.run(id, 'check', body); }
  @Put()
  connect(@Param('id') id: string, @Body() body: unknown) { return this.service.run(id, 'connect', body); }
  @Post('disconnect') @HttpCode(200)
  disconnect(@Param('id') id: string) { return this.service.run(id, 'disconnect'); }
}
