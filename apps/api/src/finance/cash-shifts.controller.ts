import { BeautyAccess } from '../beauty/access.decorator';
import 'reflect-metadata';
import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { Access } from '../auth/access.decorator';
import { CashShiftsService, type CashCommand } from './cash-shifts.service';

@Access('desk')
@Controller('cash-register')
export class CashShiftsController {
  constructor(@Inject(CashShiftsService) private readonly service: CashShiftsService) {}
  @BeautyAccess('finance', 'view')
  @Get()
  state() {
    return this.service.state();
  }
  @BeautyAccess('finance', 'create')
  @Post('command')
  command(@Body() body: CashCommand) {
    return this.service.command(body);
  }
  @Access('settings')
  @BeautyAccess('settings', 'update', { managerOnly: true })
  @Post('cashiers')
  cashiers(@Body() body: { userIds?: string[] }) {
    return this.service.cashiers(body);
  }
}
