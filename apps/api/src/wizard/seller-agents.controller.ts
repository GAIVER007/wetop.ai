import 'reflect-metadata';
import { Body, Param, Patch, Controller, Get, Header, Headers, Inject, Post } from '@nestjs/common';
import { SellerAgentsService } from './seller-agents.service';
import { Access } from '../auth/access.decorator';

/** Deliberately not @Public: uses the existing authenticated request actor. */
@Access('seller')
@Controller('seller-agents')
export class SellerAgentsController {
  constructor(@Inject(SellerAgentsService) private readonly agents: SellerAgentsService) {}
  @Get() @Header('Cache-Control', 'no-store') list() {
    return this.agents.list();
  }
  @Post()
  create(@Body() body: unknown) {
    return this.agents.create(body);
  }
  @Get(':id')
  get(@Param('id') id: string) {
    return this.agents.get(id);
  }
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.agents.update(id, body);
  }
  @Post('claim') @Header('Cache-Control', 'no-store') claim(
    @Headers('x-wizard-token') token: string | undefined,
  ) {
    return this.agents.claim(token);
  }
}
