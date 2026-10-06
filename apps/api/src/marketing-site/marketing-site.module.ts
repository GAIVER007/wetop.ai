import 'reflect-metadata';
import { Body, Controller, Get, Headers, HttpCode, Inject, Module, Post } from '@nestjs/common';
import { Access } from '../auth/access.decorator';
import { SCOPE_HEADER } from '../auth/scope';
import { PrismaService } from '../database/prisma.provider';
import { MarketingSiteService } from './marketing-site.service';

/**
 * «Маркетинг → Сайт и SEO», ядро (MKT3): сайт выбранного филиала и сохранение версий. Право `settings`, как у
 * `/website` (своего права нет, Q-273). Метки направления у маршрутов нет намеренно: без указателя она проверяла бы
 * гостиничный путь по умолчанию, а здесь нужен ответ «Выберите филиал»; направление проверяет `siteScope`.
 */
@Controller('marketing/site')
@Access('settings')
export class MarketingSiteController {
  constructor(@Inject(MarketingSiteService) private readonly service: MarketingSiteService) {}

  @Get()
  current(@Headers(SCOPE_HEADER) pointer?: string) {
    return this.service.current(!!pointer);
  }

  @Post()
  @HttpCode(201)
  create(@Headers(SCOPE_HEADER) pointer: string | undefined, @Body() body: unknown) {
    return this.service.create(!!pointer, body);
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
  providers: [PrismaService, MarketingSiteService],
})
export class MarketingSiteModule {}
