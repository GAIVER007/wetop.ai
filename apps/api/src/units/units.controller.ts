import 'reflect-metadata';
import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post } from '@nestjs/common';
import { UnitsService } from './units.service';
import { Access } from '../auth/access.decorator';

/** Ячейка: карточка, блокировки, статус уборки. */
@Access('desk')
@Controller('units')
export class UnitsController {
  constructor(@Inject(UnitsService) private readonly service: UnitsService) {}

  @Get(':code')
  card(@Param('code') code: string) {
    return this.service.card(code);
  }

  @Post(':code/blocks')
  block(
    @Param('code') code: string,
    @Body() dto: { dateFrom?: string; dateTo?: string; type?: string; reason?: string | null },
  ) {
    return this.service.block(code, dto ?? {});
  }

  @Delete(':code/blocks/:blockId')
  @HttpCode(200)
  unblock(@Param('code') code: string, @Param('blockId') blockId: string) {
    return this.service.unblock(code, blockId);
  }

  @Post(':code/housekeeping')
  @HttpCode(200)
  housekeeping(@Param('code') code: string, @Body() dto: { status?: string }) {
    return this.service.housekeeping(code, dto ?? {});
  }
}
