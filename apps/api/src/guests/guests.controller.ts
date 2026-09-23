import 'reflect-metadata';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { piiStorageMode } from '@pms/shared';
import { GuestsService } from './guests.service';

/**
 * Где лежат данные гостей (ADR-072): `real` — база в Казахстане, введённое хранится как есть; `pseudonymized` —
 * нет, и формы стойки не спрашивают имя, контакты и документы. Стойка читает режим заранее, а не узнаёт отказом.
 */
@Controller('system')
export class PiiStorageController {
  @Get('pii-storage')
  mode() {
    return { storage: piiStorageMode() };
  }
}

@Controller('guests')
export class GuestsController {
  constructor(@Inject(GuestsService) private readonly service: GuestsService) {}

  @Get()
  search(@Query('q') q?: string) {
    return this.service.search(q);
  }

  @Get(':id')
  card(@Param('id') id: string) {
    return this.service.card(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.service.update(id, dto ?? {});
  }

  @Post(':id/documents')
  addDocument(
    @Param('id') id: string,
    @Body()
    dto: {
      type?: string;
      number?: string;
      issueCountry?: string | null;
      issuedAt?: string | null;
      expiresAt?: string | null;
    },
  ) {
    return this.service.addDocument(id, dto ?? {});
  }

  @Delete(':id/documents/:documentId')
  @HttpCode(200)
  deleteDocument(@Param('id') id: string, @Param('documentId') documentId: string) {
    return this.service.deleteDocument(id, documentId);
  }
}
