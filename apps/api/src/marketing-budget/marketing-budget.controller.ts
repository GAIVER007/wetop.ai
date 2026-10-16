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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SITE_ASSET_LIMITS } from '@pms/domain';
import { Access } from '../auth/access.decorator';
import { MarketingBudgetService } from './marketing-budget.service';
import { ExpenseFilesService } from './expense-files';

const upload = () =>
  FileInterceptor('file', { limits: { fileSize: SITE_ASSET_LIMITS.maxUploadBytes, files: 1, fields: 2, parts: 4 } });

/**
 * Бюджет и расходы маркетинга (МКТ-В1/В2). Право всего раздела «Маркетинг»: `marketing`
 * (ADR-MKT-B7, Q-MKT-ROLES закрыт: своё право вместо `settings`, роли маркетолога пока нет).
 */
@Access('marketing')
@Controller('marketing')
export class MarketingBudgetController {
  constructor(
    @Inject(MarketingBudgetService) private readonly service: MarketingBudgetService,
    @Inject(ExpenseFilesService) private readonly files: ExpenseFilesService,
  ) {}

  @Get('budget')
  view(@Query('month') month?: string) {
    return this.service.view(month);
  }

  @Get('results')
  results(@Query('month') month?: string) {
    return this.service.results(month);
  }

  @Put('budget')
  @HttpCode(200)
  setPlan(@Body() dto: Record<string, unknown>) {
    return this.service.setPlan(dto ?? {});
  }

  /** Разбивка плана месяца по каналам (§52): заменяется целиком */
  @Put('budget/lines')
  @HttpCode(200)
  setLines(@Body() dto: Record<string, unknown>) {
    return this.service.setLines(dto ?? {});
  }

  @Post('expenses')
  create(@Body() dto: Record<string, unknown>) {
    return this.service.createExpense(dto ?? {});
  }

  /** Импорт из CSV: путь объявлен до `expenses/:id`, тело до 1 МБ (body-parsers.ts) */
  @Post('expenses/import')
  @HttpCode(200)
  importCsv(@Body() dto: Record<string, unknown>) {
    return this.service.importExpenses(dto ?? {});
  }

  @Patch('expenses/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: Record<string, unknown>) {
    return this.service.updateExpense(id, dto ?? {});
  }

  /** Чек или файл к расходу (§51): фото или PDF, до 10 МиБ */
  @Post('expenses/:id/files')
  @HttpCode(201)
  @UseInterceptors(upload())
  uploadFile(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: { buffer?: Buffer; originalname?: string } | undefined,
  ) {
    return this.files.upload(id, file);
  }

  @Delete('expenses/:id/files/:fileId')
  removeFile(@Param('id', ParseUUIDPipe) id: string, @Param('fileId', ParseUUIDPipe) fileId: string) {
    return this.files.remove(id, fileId);
  }

  @Delete('expenses/:id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteExpense(id);
  }
}
