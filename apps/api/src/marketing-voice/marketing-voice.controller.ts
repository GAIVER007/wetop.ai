import 'reflect-metadata';
import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { Access } from '../auth/access.decorator';
import { MarketingVoiceService } from './marketing-voice.service';

/** Журнал звонков и просьбы перезвонить. Право раздела «Продвижение»: `marketing` (Q-273, отдельного права нет) */
@Access('marketing')
@Controller('marketing/voice')
export class MarketingVoiceController {
  constructor(@Inject(MarketingVoiceService) private readonly service: MarketingVoiceService) {}

  @Get('summary')
  summary(@Query('month') month?: string) {
    return this.service.summary(month);
  }

  @Get('calls')
  calls(@Query() query: { month?: string; limit?: string; offset?: string }) {
    return this.service.calls(query);
  }

  @Get('callbacks')
  callbacks(@Query() query: { status?: string; limit?: string }) {
    return this.service.callbacks(query);
  }

  @Patch('callbacks/:id')
  close(@Param('id', ParseUUIDPipe) id: string, @Body() dto: Record<string, unknown>) {
    return this.service.closeCallback(id, dto ?? {});
  }
}
