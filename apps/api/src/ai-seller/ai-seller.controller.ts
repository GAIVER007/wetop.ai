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
import { KNOWLEDGE_MAX_BYTES, SellerService } from './seller.service';

/**
 * Раздел «ИИ-продавец» (ТЗ ред. 1 П5, П7, П8; ADR-077; контракт с ботом — docs/assistant/README.md §4).
 *
 * Явный список маршрутов, а не «всё под `/ai-seller/*`»: платформа зовёт продавца ровно тем, что нужно экранам
 * раздела. Адрес и ключ продавца живут только в окружении API; в ответах их нет.
 */
@Controller('ai-seller')
export class AiSellerController {
  constructor(@Inject(SellerService) private readonly seller: SellerService) {}

  @Get('status')
  @Header('Cache-Control', 'no-store')
  status() {
    return this.seller.status();
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

  @Post('apply')
  @HttpCode(200)
  apply() {
    return this.seller.apply();
  }

  @Get('facts')
  @Header('Cache-Control', 'no-store')
  facts() {
    return this.seller.factsPreview();
  }

  @Get('conversations')
  @Header('Cache-Control', 'no-store')
  conversations(@Query('mode') mode?: string, @Query('limit') limit?: string) {
    return this.seller.conversations({ mode, limit });
  }

  @Get('conversations/:id')
  @Header('Cache-Control', 'no-store')
  conversation(@Param('id') id: string) {
    return this.seller.conversation(id);
  }

  @Post('conversations/:id/takeover')
  @HttpCode(200)
  takeover(@Param('id') id: string) {
    return this.seller.switchMode(id, 'takeover');
  }

  @Post('conversations/:id/release')
  @HttpCode(200)
  release(@Param('id') id: string) {
    return this.seller.switchMode(id, 'release');
  }

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
