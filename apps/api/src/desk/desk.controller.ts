import 'reflect-metadata';
import { Controller, Get, Inject, Query } from '@nestjs/common';
import { DeskService } from './desk.service';
import { Access } from '../auth/access.decorator';

/** Рабочий день стойки: что делать сегодня. */
@Access('desk')
@Controller('desk')
export class DeskController {
  constructor(@Inject(DeskService) private readonly service: DeskService) {}

  @Get('today')
  today(@Query('date') date?: string) {
    return this.service.today(date);
  }
}
