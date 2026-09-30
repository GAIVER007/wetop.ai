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
import { ServiceDatabaseInterceptor } from '../database/service-database.interceptor';
import { FileInterceptor } from '@nestjs/platform-express';
import { KNOWLEDGE_MAX_BYTES, type UploadedFile as PanelFile } from '../bots/panel';
import { SupportKnowledgeService } from './support-kb.service';
import { SupportService } from './support.service';
import { Access } from '../auth/access.decorator';

/**
 * «Платформа → Техподдержка» (ADR-083, план `plans/platform-roles-extensions-2026-09-25.md` Э3): прокси к панели
 * ИИ-помощника. Явный список маршрутов — ровно то, что нужно экранам; правил помощника здесь нет. Адрес и ключ
 * панели живут только в окружении API.
 */
@Access('platform')
// RLS (DATA_MODEL §17): главный администратор читает все организации — служебной ролью базы
@UseInterceptors(ServiceDatabaseInterceptor)
@Controller('platform/support')
export class SupportController {
  constructor(
    @Inject(SupportService) private readonly support: SupportService,
    @Inject(SupportKnowledgeService) private readonly kb: SupportKnowledgeService,
  ) {}

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

  @Get('queue')
  @Header('Cache-Control', 'no-store')
  queue(@Query('queue') queue?: string) {
    return this.support.queue(queue);
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

  @Post('conversations/:id/close')
  @HttpCode(200)
  close(@Param('id') id: string) {
    return this.support.close(id);
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

  // ── управляемая база знаний (S3): публикует главный администратор, автора ставит сервер ────────────────────────

  @Get('kb')
  @Header('Cache-Control', 'no-store')
  kbList(
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('visibility') visibility?: string,
    @Query('q') q?: string,
  ) {
    return this.kb.list({ status, category, visibility, q });
  }

  @Post('kb')
  @HttpCode(200)
  kbCreate(@Body() body: unknown) {
    return this.kb.create(body);
  }

  @Get('kb/:id')
  @Header('Cache-Control', 'no-store')
  kbRead(@Param('id') id: string) {
    return this.kb.read(id);
  }

  @Put('kb/:id')
  kbUpdate(@Param('id') id: string, @Body() body: unknown) {
    return this.kb.update(id, body);
  }

  @Post('kb/:id/publish')
  @HttpCode(200)
  kbPublish(@Param('id') id: string) {
    return this.kb.publish(id);
  }

  @Post('kb/:id/status')
  @HttpCode(200)
  kbStatus(@Param('id') id: string, @Body() body: unknown) {
    return this.kb.setStatus(id, body);
  }

  @Get('conversations/:id/knowledge')
  @Header('Cache-Control', 'no-store')
  conversationKnowledge(@Param('id') id: string) {
    return this.kb.conversationSources(id);
  }

  @Get('conversations/:id/actions')
  @Header('Cache-Control', 'no-store')
  conversationActions(@Param('id') id: string) {
    return this.kb.conversationActions(id);
  }

  @Post('conversations/:id/knowledge-draft')
  @HttpCode(200)
  knowledgeDraft(@Param('id') id: string) {
    return this.kb.draftFromConversation(id);
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
