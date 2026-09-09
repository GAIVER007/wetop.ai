import 'reflect-metadata';
import { Body, Controller, Get, Inject, Post, Query } from '@nestjs/common';
import { RatesService, type RateChangeDto } from './rates.service';

/** Календарь цен и ограничений: чтение и массовое изменение (стойка). Изменения уходят в каналы через очередь. */
@Controller('rates')
export class RatesController {
  constructor(@Inject(RatesService) private readonly service: RatesService) {}

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

  @Post('bulk')
  bulk(@Body() dto: { changes?: RateChangeDto[] }) {
    return this.service.bulk(dto ?? {});
  }
}
