import 'reflect-metadata';
import { Body, Controller, Get, Headers, HttpCode, Inject, Module, Post, Query } from '@nestjs/common';
import { Access } from '../auth/access.decorator';
import { SCOPE_HEADER } from '../auth/scope';
import { PrismaService } from '../database/prisma.provider';
import { contentReaderFromEnv } from '../channels/content';
import { MarketingSiteService } from './marketing-site.service';
import { BRIEF_CHANNEX_READER, SiteBriefService } from './brief.service';

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
    { provide: BRIEF_CHANNEX_READER, useFactory: contentReaderFromEnv },
  ],
})
export class MarketingSiteModule {}
