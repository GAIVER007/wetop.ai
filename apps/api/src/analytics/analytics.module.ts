import 'reflect-metadata';
import { Module, RequestMethod, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { text, type NextFunction, type Request, type Response } from 'express';
import { HIT_LIMITS } from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';
import { AnalyticsController } from './analytics.controller';
import { ANALYTICS_REPOSITORY, PrismaAnalyticsRepository } from './analytics.repository';
import { AnalyticsService } from './analytics.service';
import { CollectController } from './collect.controller';
import { CollectService } from './collect.service';

/** Аналитика сайта (DATA_MODEL §11, срез 8): публичный приёмник `/a/*` и отчёты `/analytics/*`. */
@Module({
  controllers: [CollectController, AnalyticsController],
  providers: [
    PrismaService,
    CollectService,
    AnalyticsService,
    { provide: ANALYTICS_REPOSITORY, useClass: PrismaAnalyticsRepository },
  ],
  // Виджет бронирования (срез 9) работает с тем же «сайтом»
  exports: [ANALYTICS_REPOSITORY, CollectService],
})
export class AnalyticsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Счётчик шлёт text/plain (без preflight; так же sendBeacon). Глобальный разбор JSON уже отработал
    // и для application/json тело — объект; здесь дочитываем остальное строкой, не длиннее лимита.
    // Ошибка разбора (тело больше лимита) — молча 204: ошибка middleware до фильтров контроллера не доходит.
    const parser = text({ type: () => true, limit: HIT_LIMITS.body });
    const quietText = (req: Request, res: Response, next: NextFunction) =>
      parser(req, res, (err?: unknown) => (err ? res.status(204).end() : next()));
    consumer.apply(quietText).forRoutes({ path: 'a/hit', method: RequestMethod.POST });
  }
}
