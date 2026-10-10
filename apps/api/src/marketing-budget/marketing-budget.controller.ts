import 'reflect-metadata';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Access } from '../auth/access.decorator';
import { MarketingBudgetService } from './marketing-budget.service';

/**
 * Бюджет и расходы маркетинга (МКТ-В1/В2). Право как у всего раздела «Маркетинг»: `settings`
 * (своего права у маркетинга нет, Q-273; матрица ролей ТЗ §3: этап В7, Q-MKT-ROLES).
 */
@Access('settings')
@Controller('marketing')
export class MarketingBudgetController {
  constructor(@Inject(MarketingBudgetService) private readonly service: MarketingBudgetService) {}

  @Get('budget')
  view(@Query('month') month?: string) {
    return this.service.view(month);
  }

  @Put('budget')
  @HttpCode(200)
  setPlan(@Body() dto: Record<string, unknown>) {
    return this.service.setPlan(dto ?? {});
  }

  @Post('expenses')
  create(@Body() dto: Record<string, unknown>) {
    return this.service.createExpense(dto ?? {});
  }

  @Patch('expenses/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: Record<string, unknown>) {
    return this.service.updateExpense(id, dto ?? {});
  }

  @Delete('expenses/:id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteExpense(id);
  }
}
