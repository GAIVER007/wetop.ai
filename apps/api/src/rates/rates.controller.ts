import 'reflect-metadata';
import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { RatesService, type RateChangeDto } from './rates.service';
import { RatePlansService } from './rate-plans';
import { Access } from '../auth/access.decorator';

/**
 * Календарь цен и ограничений: чтение и массовое изменение (стойка). Изменения уходят в каналы через очередь.
 * «Тарифные планы» (SET4): список тарифов с правилом отмены и правка правила — то же право `rates`.
 */
@Access('rates')
@Controller('rates')
export class RatesController {
  constructor(
    @Inject(RatesService) private readonly service: RatesService,
    @Inject(RatePlansService) private readonly plans: RatePlansService,
  ) {}

  @Get('options')
  options() {
    return this.service.options();
  }

  @Get()
  calendar(
    @Query('accommodationTypeCode') accommodationTypeCode?: string,
    @Query('ratePlanCode') ratePlanCode?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.calendar({ accommodationTypeCode, ratePlanCode, from, to });
  }

  @Get('plans')
  ratePlans() {
    return this.plans.list();
  }

  @Patch('plans/:code')
  updateRatePlan(@Param('code') code: string, @Body() body: unknown) {
    return this.plans.updatePenalty(code, body);
  }

  @Post('bulk')
  bulk(@Body() dto: { changes?: RateChangeDto[] }) {
    return this.service.bulk(dto ?? {});
  }
}
