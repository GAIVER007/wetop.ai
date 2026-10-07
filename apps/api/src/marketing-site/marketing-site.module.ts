import 'reflect-metadata';
import { Body, Controller, Get, Headers, HttpCode, Inject, Module, Param, Post, Query, Res } from '@nestjs/common';
import { Access } from '../auth/access.decorator';
import { SCOPE_HEADER } from '../auth/scope';
import { PrismaService } from '../database/prisma.provider';
import { contentReaderFromEnv } from '../channels/content';
import { MarketingSiteService } from './marketing-site.service';
import { BRIEF_CHANNEX_READER, SiteBriefService } from './brief.service';
import { GENERATION_BOT, generationBotFromEnv } from './generation.bot';
import { SiteGenerationService } from './generation.service';
import { SiteGenerationWorker } from './generation.worker';

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
  ) {}

  @Get()
  current(@Headers(SCOPE_HEADER) pointer?: string) {
    return this.service.current(!!pointer);
  }

  @Post()
  @HttpCode(201)
  create(@Headers(SCOPE_HEADER) pointer: string | undefined, @Body() body: unknown) {
    return this.service.create(!!pointer, body);
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
}

@Module({
  controllers: [MarketingSiteController],
  providers: [
    PrismaService,
    MarketingSiteService,
    SiteBriefService,
    SiteGenerationService,
    SiteGenerationWorker,
    { provide: BRIEF_CHANNEX_READER, useFactory: contentReaderFromEnv },
    { provide: GENERATION_BOT, useFactory: generationBotFromEnv },
  ],
})
export class MarketingSiteModule {}
