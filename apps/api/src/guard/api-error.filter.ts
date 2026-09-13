import 'reflect-metadata';
import { Catch, HttpException, Inject, Logger, type ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { GuardService } from './guard.service';

/**
 * Ответ 500 от кода → неисправность `api.error` (класс В, ADR-028). Ответ клиенту не меняется: его, как и раньше,
 * формирует стандартный фильтр Nest. Пишется только настоящая поломка программы — необработанное исключение или
 * HTTP 500. Ответы 502/503/504 — это «внешняя система не ответила» (Channex, ключ не вписан): их ловят другие
 * проверки сторожа, и дежурному агенту чинить в коде нечего. Тело запроса и заголовки не пишутся (ПД, секреты).
 */
@Catch()
export class ApiErrorFilter extends BaseExceptionFilter {
  private readonly log = new Logger(ApiErrorFilter.name);
  constructor(@Inject(GuardService) private readonly guard: GuardService) {
    super();
  }

  override catch(exception: unknown, host: ArgumentsHost): void {
    super.catch(exception, host);
    if (host.getType() !== 'http') return;
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    if (status !== 500) return;
    const req = host.switchToHttp().getRequest<{ method?: string; route?: { path?: string } }>();
    this.guard
      .recordApiError({
        method: req.method ?? '?',
        route: req.route?.path ?? '(маршрут не найден)',
        status,
        error: exception,
      })
      .catch((e: unknown) => this.log.warn(`неисправность не записана: ${(e as Error).message}`));
  }
}
