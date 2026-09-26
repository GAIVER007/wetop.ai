import 'reflect-metadata';
import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { KNOWLEDGE_MAX_BYTES, type UploadedFile as PanelFile } from '../bots/panel';
import { SupportService } from './support.service';

/**
 * «Платформа → Техподдержка» (ADR-083, план `plans/platform-roles-extensions-2026-09-25.md` Э3): прокси к панели
 * ИИ-помощника. Явный список маршрутов — ровно то, что нужно экранам; правил помощника здесь нет. Адрес и ключ
 * панели живут только в окружении API.
 */
@Controller('platform/support')
export class SupportController {
  constructor(@Inject(SupportService) private readonly support: SupportService) {}

  @Get('status')
  @Header('Cache-Control', 'no-store')
  status() {
    return this.support.status();
  }

  @Get('conversations')
  @Header('Cache-Control', 'no-store')
  conversations(@Query('mode') mode?: string, @Query('limit') limit?: string) {
    return this.support.conversations({ mode, limit });
  }

  @Get('conversations/:id')
  @Header('Cache-Control', 'no-store')
  conversation(@Param('id') id: string) {
    return this.support.conversation(id);
  }

  @Post('conversations/:id/takeover')
  @HttpCode(200)
  takeover(@Param('id') id: string) {
    return this.support.switchMode(id, 'takeover');
  }

  @Post('conversations/:id/release')
  @HttpCode(200)
  release(@Param('id') id: string) {
    return this.support.switchMode(id, 'release');
  }

  @Post('conversations/:id/reply')
  @HttpCode(200)
  reply(@Param('id') id: string, @Body() body: { text?: unknown } | undefined) {
    return this.support.reply(id, body?.text);
  }

  @Get('knowledge')
  @Header('Cache-Control', 'no-store')
  knowledge() {
    return this.support.knowledge();
  }

  /** Документ базы знаний помощника: один файл в поле `file`, в памяти, не больше 10 МБ; имя — в UTF-8 */
  @Post('knowledge')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: KNOWLEDGE_MAX_BYTES, files: 1 },
      defParamCharset: 'utf8',
    }),
  )
  uploadKnowledge(@UploadedFile() file: PanelFile | undefined) {
    return this.support.uploadKnowledge(file);
  }

  @Get('summary')
  @Header('Cache-Control', 'no-store')
  summary() {
    return this.support.summary();
  }

  // ── настройка помощника (ADR-084) ──────────────────────────────────────────────────────────

  @Get('prompt')
  @Header('Cache-Control', 'no-store')
  prompt() {
    return this.support.prompt();
  }

  @Put('prompt')
  savePrompt(@Body() body: { text?: unknown } | undefined) {
    return this.support.savePrompt(body?.text);
  }

  @Get('settings')
  @Header('Cache-Control', 'no-store')
  settings() {
    return this.support.settings();
  }

  @Put('settings/model')
  saveModel(@Body() body: { model?: unknown } | undefined) {
    return this.support.saveModel(body?.model);
  }

  @Post('sandbox')
  @HttpCode(200)
  sandbox(@Body() body: { text?: unknown } | undefined) {
    return this.support.sandbox(body?.text);
  }
}
