import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import {
  Catch,
  HttpException,
  Inject,
  Logger,
  Optional,
  type ArgumentsHost,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import {
  UserErrorDedupe,
  isUserErrorRecorded,
  userErrorMessage,
} from '@pms/domain';
import type { SignedInUser } from '../auth/auth.service';
import {
  USER_ERRORS_REPOSITORY,
  type UserErrorsRepository,
} from '../assistant/user-errors.repository';
import { GuardService } from './guard.service';

/** Заголовок ответа с номером запроса: по нему человек и помощник называют ошибку (DATA_MODEL §14) */
export const REQUEST_ID_HEADER = 'X-Request-Id';

interface HttpRequest {
  method?: string;
  route?: { path?: string };
  user?: SignedInUser;
}

interface HttpResponse {
  headersSent?: boolean;
  setHeader?: (name: string, value: string) => void;
}

/**
 * Ответ с ошибкой — в два журнала. Ответ клиенту не меняется: его, как и раньше, формирует стандартный фильтр Nest.
 *
 * 1. **Неисправность `api.error`** (класс В, ADR-028) — только настоящая поломка программы: необработанное
 *    исключение или HTTP 500. Ответы 502/503/504 — это «внешняя система не ответила» (Channex, ключ не вписан): их
 *    ловят другие проверки сторожа, и дежурному агенту чинить в коде нечего.
 * 2. **Ошибка, которую увидел человек** (DATA_MODEL §14, ТЗ ред. 1 П3) — любой 4xx и 5xx вошедшему: шаблон маршрута,
 *    код, текст ответа с маской, номер запроса. Его читает ИИ-помощник. Невошедший, маршруты помощника и повтор
 *    той же ошибки в ту же минуту не пишутся.
 *
 * Тело запроса, заголовки и значения из адреса не пишутся никуда (ПД, секреты). Запись идёт после ответа и
 * ответа не задерживает; не записалось — предупреждение в журнал API, человек получает свой ответ как обычно.
 */
@Catch()
export class ApiErrorFilter extends BaseExceptionFilter {
  private readonly log = new Logger(ApiErrorFilter.name);
  private readonly dedupe = new UserErrorDedupe();

  constructor(
    @Inject(GuardService) private readonly guard: GuardService,
    @Optional()
    @Inject(USER_ERRORS_REPOSITORY)
    private readonly userErrors: UserErrorsRepository | null = null,
  ) {
    super();
  }

  override catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.getType() === 'http' ? host.switchToHttp() : null;
    const req = http?.getRequest<HttpRequest>();
    const res = http?.getResponse<HttpResponse>();
    const requestId = randomUUID();
    if (res && !res.headersSent && typeof res.setHeader === 'function')
      res.setHeader(REQUEST_ID_HEADER, requestId);

    super.catch(exception, host);
    if (!req) return;

    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const route = req.route?.path ?? '';
    if (status === 500) {
      this.guard
        .recordApiError({
          method: req.method ?? '?',
          route: route || '(маршрут не найден)',
          status,
          error: exception,
        })
        .catch((e: unknown) => this.log.warn(`неисправность не записана: ${(e as Error).message}`));
    }
    this.recordUserError(req, route, status, exception, requestId);
  }

  private recordUserError(
    req: HttpRequest,
    route: string,
    status: number,
    exception: unknown,
    requestId: string,
  ): void {
    const user = req.user;
    if (!this.userErrors || !user || !isUserErrorRecorded(status, route)) return;
    const method = (req.method ?? 'GET').toUpperCase();
    const message = userErrorMessage(
      exception instanceof HttpException ? exception.getResponse() : null,
    );
    const now = new Date();
    if (!this.dedupe.firstSeen({ userId: user.id, method, route, status, message }, now.getTime()))
      return;
    this.userErrors
      .record({
        at: now,
        userId: user.id,
        organizationId: user.organizationId,
        method,
        route,
        status,
        message,
        requestId,
      })
      .catch((e: unknown) =>
        this.log.warn(`ошибка человека не записана в журнал: ${(e as Error).message}`),
      );
  }
}
