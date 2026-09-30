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
import { SellerCatalogService } from './seller-catalog.service';
import { KNOWLEDGE_MAX_BYTES, SellerService } from './seller.service';
import { Access } from '../auth/access.decorator';

/**
 * Раздел «ИИ-продавец» (ТЗ ред. 1 П5, П7, П8; ADR-079; контракт с ботом — docs/assistant/README.md §4).
 *
 * Явный список маршрутов, а не «всё под `/ai-seller/*`»: платформа зовёт продавца ровно тем, что нужно экранам
 * раздела. Адрес и ключ продавца живут только в окружении API; в ответах их нет.
 */
@Access('seller')
@Controller('ai-seller')
export class AiSellerController {
  constructor(
    @Inject(SellerService) private readonly seller: SellerService,
    @Inject(SellerCatalogService) private readonly agents: SellerCatalogService,
  ) {}

  @Access('dialogs')
  @Get('status')
  @Header('Cache-Control', 'no-store')
  status() {
    return this.seller.status();
  }

  /**
   * Каталог AI-агентов организации (SA1): расширение и карточки. Видят все роли с диалогами; кнопки — по `canManage`.
   * Не бросает при выключенном расширении: страница объясняет, а не падает.
   */
  @Access('dialogs')
  @Get('catalog')
  @Header('Cache-Control', 'no-store')
  catalog() {
    return this.agents.list();
  }

  @Get('profile')
  @Header('Cache-Control', 'no-store')
  profile() {
    return this.seller.profile();
  }

  @Put('profile')
  saveProfile(@Body() body: unknown) {
    return this.seller.saveProfile(body);
  }

  /** Инструкция продавцу одним текстом (ADR-097) */
  @Get('prompt')
  @Header('Cache-Control', 'no-store')
  prompt() {
    return this.seller.prompt();
  }

  @Put('prompt')
  savePrompt(@Body() body: { text?: unknown } | undefined) {
    return this.seller.savePrompt(body?.text);
  }

  @Post('apply')
  @HttpCode(200)
  apply() {
    return this.seller.apply();
  }

  /** Рассказ о гостинице своими словами → черновик профиля мастера (С1); адрес и цены — только сверить */
  @Post('extract')
  @HttpCode(200)
  extract(@Body() body: { story?: unknown } | undefined) {
    return this.seller.extract(body?.story);
  }

  /** Ключ модели партнёра (С2): хранит бот, наружу — «установлен + последние 4 знака» */
  @Get('llm-key')
  @Header('Cache-Control', 'no-store')
  llmKey() {
    return this.seller.llmKey();
  }

  @Put('llm-key')
  saveLlmKey(@Body() body: { key?: unknown } | undefined) {
    return this.seller.saveLlmKey(body?.key);
  }

  @Post('llm-key/check')
  @HttpCode(200)
  checkLlmKey(@Body() body: { key?: unknown } | undefined) {
    return this.seller.checkLlmKey(body?.key);
  }

  /** Подключение WhatsApp (С3): номер, слово и адрес вебхука для консоли Meta; токена в ответах нет */
  @Get('whatsapp')
  @Header('Cache-Control', 'no-store')
  whatsapp() {
    return this.seller.whatsapp();
  }

  @Put('whatsapp')
  saveWhatsApp(@Body() body: unknown) {
    return this.seller.saveWhatsApp(body);
  }

  @Post('whatsapp/check')
  @HttpCode(200)
  checkWhatsApp(@Body() body: unknown) {
    return this.seller.checkWhatsApp(body);
  }

  @Get('facts')
  @Header('Cache-Control', 'no-store')
  facts() {
    return this.seller.factsPreview();
  }

  @Access('dialogs')
  @Get('conversations')
  @Header('Cache-Control', 'no-store')
  conversations(@Query('mode') mode?: string, @Query('limit') limit?: string) {
    return this.seller.conversations({ mode, limit });
  }

  @Access('dialogs')
  @Get('conversations/:id')
  @Header('Cache-Control', 'no-store')
  conversation(@Param('id') id: string) {
    return this.seller.conversation(id);
  }

  @Access('dialogs')
  @Post('conversations/:id/takeover')
  @HttpCode(200)
  takeover(@Param('id') id: string) {
    return this.seller.switchMode(id, 'takeover');
  }

  @Access('dialogs')
  @Post('conversations/:id/release')
  @HttpCode(200)
  release(@Param('id') id: string) {
    return this.seller.switchMode(id, 'release');
  }

  @Access('dialogs')
  @Post('conversations/:id/reply')
  @HttpCode(200)
  reply(@Param('id') id: string, @Body() body: { text?: unknown } | undefined) {
    return this.seller.reply(id, body?.text);
  }

  @Get('knowledge')
  @Header('Cache-Control', 'no-store')
  knowledge() {
    return this.seller.knowledge();
  }

  /** Документ базы знаний продавца: один файл в поле `file`, в памяти, не больше 10 МБ; имя — в UTF-8 */
  @Post('knowledge')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: KNOWLEDGE_MAX_BYTES, files: 1 },
      defParamCharset: 'utf8',
    }),
  )
  uploadKnowledge(
    @UploadedFile() file: { originalname: string; size: number; buffer: Buffer } | undefined,
  ) {
    return this.seller.uploadKnowledge(file);
  }

  @Access('dialogs')
  @Get('summary')
  @Header('Cache-Control', 'no-store')
  summary() {
    return this.seller.summary();
  }

  @Post('sandbox')
  @HttpCode(200)
  sandbox(@Body() body: { text?: unknown } | undefined) {
    return this.seller.sandbox(body?.text);
  }

  @Get('embed')
  @Header('Cache-Control', 'no-store')
  embed() {
    return this.seller.embed();
  }
}
