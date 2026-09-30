import 'reflect-metadata';
import { Body, Controller, Get, Header, HttpCode, Inject, Param, Post, Put } from '@nestjs/common';
import { Access } from '../auth/access.decorator';
import { AgentInstructionsService } from './agent-instructions.service';

@Access('seller')
@Controller('ai-seller/agents/:id/instruction')
export class AgentInstructionsController {
  constructor(@Inject(AgentInstructionsService) private readonly instructions: AgentInstructionsService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  get(@Param('id') id: string) { return this.instructions.get(id); }
  @Put()
  save(@Param('id') id: string, @Body() body: {text?: unknown} | undefined) { return this.instructions.save(id, body?.text); }
  @Post('generate')
  @HttpCode(200)
  generate(@Param('id') id: string, @Body() body: {story?: unknown} | undefined) { return this.instructions.generate(id, body?.story); }
}
