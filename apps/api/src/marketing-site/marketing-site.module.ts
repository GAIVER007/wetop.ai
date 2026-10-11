import 'reflect-metadata';
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Module,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SITE_ASSET_LIMITS } from '@pms/domain';
import { Access } from '../auth/access.decorator';
import { SCOPE_HEADER } from '../auth/scope';
import { PrismaService } from '../database/prisma.provider';
import { contentReaderFromEnv } from '../channels/content';
import { MarketingSiteService } from './marketing-site.service';
import { BRIEF_CHANNEX_READER, SiteBriefService } from './brief.service';
import { GENERATION_BOT, generationBotFromEnv } from './generation.bot';
import { SiteGenerationService } from './generation.service';
import { SiteGenerationWorker } from './generation.worker';
import { SitePublicationService } from './publication.service';
import { ASSET_FETCH_DEPS, SiteAssetsService } from './site-assets.service';
import { SITE_ASSET_STORAGE, siteAssetStorageFromEnv } from './asset-storage';
import { SiteAssistantService } from './assistant.service';

/**
 * «Маркетинг → Сайт и SEO», ядро (MKT3): сайт выбранного филиала и сохранение версий. Право `settings`, как у
 * `/website` (своего права нет, Q-273). Метки направления у маршрутов нет намеренно: без указателя она проверяла бы
 * гостиничный путь по умолчанию, а здесь нужен ответ «Выберите филиал»; направление проверяет `siteScope`.
 */
@Controller('marketing/site')
@Access('settings')
export class MarketingSiteController {
  constructor(
    @Inject(MarketingSiteService) private readonly service: MarketingSiteService,
    @Inject(SiteBriefService) private readonly briefs: SiteBriefService,
    @Inject(SiteGenerationService) private readonly generations: SiteGenerationService,
    @Inject(SitePublicationService) private readonly publication: SitePublicationService,
    @Inject(SiteAssetsService) private readonly assets: SiteAssetsService,
    @Inject(SiteAssistantService) private readonly assistant: SiteAssistantService,
  ) {}

  @Get()
  current(@Headers(SCOPE_HEADER) pointer?: string) {
    return this.service.current(!!pointer);
  }

  /**
   * MKT9.2: заведение сайта филиала с пустым телом (имя и адрес из филиала). Новый 201, уже есть 200, архив 409.
   * Прежний `POST /marketing/site` с названием и адресом снят: второй сайт филиала не заводится никаким путём
   */
  @Post('bootstrap')
  async bootstrap(
    @Headers(SCOPE_HEADER) pointer: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: { status(code: number): unknown },
  ) {
    const result = await this.service.bootstrap(!!pointer, body);
    res.status(result.created ? 201 : 200);
    return result;
  }

  /** MKT9.2: знания проекта (постоянные указания ИИ этого сайта) */
  @Get('context')
  context(@Headers(SCOPE_HEADER) pointer?: string) {
    return this.service.context(!!pointer);
  }

  @Patch('context')
  updateContext(@Headers(SCOPE_HEADER) pointer: string | undefined, @Body() body: unknown) {
    return this.service.updateContext(!!pointer, body);
  }

  /** MKT9.2: разговор сайта одним списком (сборки и разговорные задачи), последние до 100 */
  @Get('conversation')
  conversation(@Headers(SCOPE_HEADER) pointer: string | undefined, @Query('limit') limit?: string) {
    return this.assistant.conversation(!!pointer, limit);
  }

  /** MKT9.2: Чат, План, Оформление. Новая задача 202, повтор того же ключа 200; версий не создаёт */
  @Post('assistant')
  async assistantRequest(
    @Headers(SCOPE_HEADER) pointer: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: { status(code: number): unknown },
  ) {
    const result = await this.assistant.request(!!pointer, body);
    res.status(result.created ? 202 : 200);
    return { run: result.run };
  }

  @Get('assistant/:id')
  assistantStatus(@Headers(SCOPE_HEADER) pointer: string | undefined, @Param('id') id: string) {
    return this.assistant.status(!!pointer, id);
  }

  /** MKT9.2: «Собрать по плану» ставит ровно одну задачу сборки на план (202 новая, 200 повтор) */
  @Post('assistant/:id/approve')
  async assistantApprove(
    @Headers(SCOPE_HEADER) pointer: string | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: { status(code: number): unknown },
  ) {
    const result = await this.assistant.approve(!!pointer, id, body);
    res.status(result.created ? 202 : 200);
    return { run: result.run };
  }

  /** Бриф сайта филиала (MKT5): только чтение; `?refresh=1` обходит кэш Channex и больше ничего не меняет */
  @Get('brief')
  brief(@Headers(SCOPE_HEADER) pointer?: string, @Query('refresh') refresh?: string) {
    return this.briefs.brief(!!pointer, refresh === '1' || refresh === 'true');
  }

  /**
   * Генерация первой версии ИИ (MKT6): ставит задачу INITIAL в очередь. Новая задача 202, повтор того же `requestKey`
   * 200 с той же задачей. Модель зовёт воркер, ответ не ждёт генерации.
   */
  @Post('generations')
  async requestGeneration(
    @Headers(SCOPE_HEADER) pointer: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: { status(code: number): unknown },
  ) {
    const result = await this.generations.request(!!pointer, body);
    res.status(result.created ? 202 : 200);
    return { run: result.run };
  }

  @Get('generations/:id')
  generation(@Headers(SCOPE_HEADER) pointer: string | undefined, @Param('id') id: string) {
    return this.generations.status(!!pointer, id);
  }

  @Get('draft')
  draft(@Headers(SCOPE_HEADER) pointer?: string) {
    return this.service.draft(!!pointer);
  }

  @Post('versions')
  @HttpCode(201)
  saveVersion(@Headers(SCOPE_HEADER) pointer: string | undefined, @Body() body: unknown) {
    return this.service.saveVersion(!!pointer, body);
  }

  /** MKT9: история версий без документа, до 100 последних */
  @Get('versions')
  versions(@Headers(SCOPE_HEADER) pointer?: string) {
    return this.service.versions(!!pointer);
  }

  /** MKT9: одна версия этого сайта с документом (только управление; рантайм старых версий не читает) */
  @Get('versions/:id')
  version(@Headers(SCOPE_HEADER) pointer: string | undefined, @Param('id') id: string) {
    return this.service.version(!!pointer, id);
  }

  /** MKT9: смысловая разница `against → :id` */
  @Get('versions/:id/diff')
  versionDiff(@Headers(SCOPE_HEADER) pointer: string | undefined, @Param('id') id: string, @Query('against') against?: string) {
    return this.service.diff(!!pointer, id, against);
  }

  /** MKT9.2: закладка версии (поставить или переименовать) */
  @Put('versions/:id/bookmark')
  bookmark(@Headers(SCOPE_HEADER) pointer: string | undefined, @Param('id') id: string, @Body() body: unknown) {
    return this.service.bookmark(!!pointer, id, body);
  }

  @Delete('versions/:id/bookmark')
  removeBookmark(@Headers(SCOPE_HEADER) pointer: string | undefined, @Param('id') id: string) {
    return this.service.removeBookmark(!!pointer, id);
  }

  /** MKT9: восстановить как новый черновик; опубликованная версия не меняется (это не откат MKT7) */
  @Post('versions/:id/restore')
  @HttpCode(201)
  restoreVersion(@Headers(SCOPE_HEADER) pointer: string | undefined, @Param('id') id: string, @Body() body: unknown) {
    return this.service.restore(!!pointer, id, body);
  }

  /** MKT7: подписанная ссылка предпросмотра одной версии на 60 минут; хост превью, а не домен сайта */
  @Post('preview')
  @HttpCode(200)
  preview(@Headers(SCOPE_HEADER) pointer: string | undefined, @Body() body: unknown) {
    return this.publication.preview(!!pointer, body);
  }

  /** MKT7: публикует только голову черновика; адрес сайта строит сервер, браузер хост не передаёт */
  @Post('publish')
  @HttpCode(200)
  publish(@Headers(SCOPE_HEADER) pointer: string | undefined, @Body() body: unknown) {
    return this.publication.publish(!!pointer, body);
  }

  @Post('pause')
  @HttpCode(200)
  pause(@Headers(SCOPE_HEADER) pointer: string | undefined, @Body() body: unknown) {
    return this.publication.pause(!!pointer, body);
  }

  @Post('resume')
  @HttpCode(200)
  resume(@Headers(SCOPE_HEADER) pointer: string | undefined, @Body() body: unknown) {
    return this.publication.resume(!!pointer, body);
  }

  /** MKT7: только на ранее опубликованную версию этого сайта; голова черновика не меняется */
  @Post('rollback')
  @HttpCode(200)
  rollback(@Headers(SCOPE_HEADER) pointer: string | undefined, @Body() body: unknown) {
    return this.publication.rollback(!!pointer, body);
  }

  @Post('archive')
  @HttpCode(200)
  archive(@Headers(SCOPE_HEADER) pointer: string | undefined, @Body() body: unknown) {
    return this.publication.archive(!!pointer, body);
  }

  @Get('publications')
  publications(@Headers(SCOPE_HEADER) pointer?: string) {
    return this.publication.publications(!!pointer);
  }

  /** MKT7, Q-275: канонический сайт брони филиала для ИИ-продавца; варианты только точного объекта */
  @Get('booking-source')
  bookingSource(@Headers(SCOPE_HEADER) pointer?: string) {
    return this.publication.bookingSource(!!pointer);
  }

  @Put('booking-source')
  setBookingSource(@Headers(SCOPE_HEADER) pointer: string | undefined, @Body() body: unknown) {
    return this.publication.setBookingSource(!!pointer, body);
  }

  // ---------- MKT8: библиотека изображений ----------

  /** Библиотека филиала без удалённых; у каждой картинки подписанный адрес на срок, ключа объекта нет */
  @Get('assets')
  assetList(@Headers(SCOPE_HEADER) pointer?: string) {
    return this.assets.list(!!pointer);
  }

  /**
   * Загрузка: `multipart/form-data`, один файл до 10 МиБ в памяти процесса (на диск не пишется), поля `kind` и
   * `defaultAlt`. Предел только этого маршрута, общий JSON-парсер не меняется. Новый 201, повтор той же картинки 200
   */
  @Post('assets')
  @UseInterceptors(
    // без `storage` и `dest` multer держит файл в памяти (MemoryStorage), на диск ничего не пишется
    FileInterceptor('file', {
      limits: { fileSize: SITE_ASSET_LIMITS.maxUploadBytes, files: 1, fields: 4, fieldSize: 4096, parts: 6 },
    }),
  )
  async assetUpload(
    @Headers(SCOPE_HEADER) pointer: string | undefined,
    @UploadedFile() file: { buffer?: Buffer } | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: { status(code: number): unknown },
  ) {
    const result = await this.assets.upload(!!pointer, file, body);
    res.status(result.created ? 201 : 200);
    return result;
  }

  @Patch('assets/:id')
  assetUpdate(@Headers(SCOPE_HEADER) pointer: string | undefined, @Param('id') id: string, @Body() body: unknown) {
    return this.assets.updateAlt(!!pointer, id, body);
  }

  @Delete('assets/:id')
  assetDelete(@Headers(SCOPE_HEADER) pointer: string | undefined, @Param('id') id: string) {
    return this.assets.remove(!!pointer, id);
  }

  /** Фото менеджера каналов объекта этого филиала: коды фото без адресов */
  @Get('assets/channex')
  assetChannex(@Headers(SCOPE_HEADER) pointer?: string) {
    return this.assets.channexPhotos(!!pointer);
  }

  @Post('assets/channex/import')
  @HttpCode(200)
  assetChannexImport(@Headers(SCOPE_HEADER) pointer: string | undefined, @Body() body: unknown) {
    return this.assets.importChannex(!!pointer, body);
  }
}

@Module({
  controllers: [MarketingSiteController],
  providers: [
    PrismaService,
    MarketingSiteService,
    SiteBriefService,
    SiteGenerationService,
    SiteGenerationWorker,
    SitePublicationService,
    SiteAssetsService,
    SiteAssistantService,
    { provide: BRIEF_CHANNEX_READER, useFactory: contentReaderFromEnv },
    { provide: SITE_ASSET_STORAGE, useFactory: () => siteAssetStorageFromEnv() },
    // null: настоящий загрузчик с DNS и HTTPS (asset-fetch.ts); тесты подставляют свой
    { provide: ASSET_FETCH_DEPS, useValue: null },
    { provide: GENERATION_BOT, useFactory: generationBotFromEnv },
  ],
})
export class MarketingSiteModule {}
