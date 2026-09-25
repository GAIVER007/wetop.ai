import 'reflect-metadata';
import { CallHandler, ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import { from, lastValueFrom, type Observable } from 'rxjs';
import type { SignedInUser } from './auth.service';
import { withSignedInUser } from './request-context';

/**
 * Оборачивает обработку запроса в контекст вошедшего, чтобы `audit_logs.user_id` заполнялся сам:
 * ни один репозиторий для этого не переписывается (ADR-023, DATA_MODEL §13 шаг 1).
 *
 * Здесь же в контекст кладётся организация вошедшего: по ней репозитории открывают его объект и
 * не открывают чужой (ADR-061).
 *
 * Запрос без сессии — сторож, импорт из Exely, скрипт сверки: у их записей автора нет, и это верно.
 */
@Injectable()
export class AuthorInterceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<{ user?: SignedInUser }>();
    const actor = {
      userId: request?.user?.id ?? null,
      // Организация вошедшего — то, по чему видно, чей объект открывать (ADR-061)
      organizationId: request?.user?.organizationId ?? null,
      // роль и отметка главного администратора — для прав владельца и раздела «Платформа» (ADR-083)
      role: request?.user?.role ?? null,
      platformAdmin: request?.user?.platformAdmin === true,
    };
    const value = await withSignedInUser(actor, () =>
      lastValueFrom(next.handle(), { defaultValue: undefined }),
    );
    return from([value]);
  }
}
