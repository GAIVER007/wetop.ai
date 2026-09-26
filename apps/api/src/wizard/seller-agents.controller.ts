import 'reflect-metadata';
import { Controller, Get, Header, Headers, Inject, Post } from '@nestjs/common';
import { SellerAgentsService } from './seller-agents.service';

/** Deliberately not @Public: uses the existing authenticated request actor. */
@Controller('seller-agents')
export class SellerAgentsController {
  constructor(@Inject(SellerAgentsService) private readonly agents: SellerAgentsService) {}
  @Get() @Header('Cache-Control', 'no-store') list() {
    return this.agents.list();
  }
  @Post('claim') @Header('Cache-Control', 'no-store') claim(
    @Headers('x-wizard-token') token: string | undefined,
  ) {
    return this.agents.claim(token);
  }
}
