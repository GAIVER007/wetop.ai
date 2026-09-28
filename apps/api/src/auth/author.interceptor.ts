import 'reflect-metadata';
import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  Optional,
  type NestInterceptor,
} from '@nestjs/common';
import { from, lastValueFrom, type Observable } from 'rxjs';
import { PrismaService } from '../database/prisma.provider';
import type { SignedInUser } from './auth.service';
import { withSignedInUser } from './request-context';
import { SCOPE_HEADER, parseScopePointer, resolveScope, type ResolvedScope } from './scope';

/**
 * Оборачивает обработку запроса в контекст вошедшего, чтобы `audit_logs.user_id` заполнялся сам:
 * ни один репозиторий для этого не переписывается (ADR-023, DATA_MODEL §13 шаг 1).
 *
 * Здесь же в контекст кладётся организация вошедшего: по ней репозитории открывают его объект и
 * не открывают чужой (ADR-061).
 *
 * И scope запроса (Platform P2, К1; план P2 §4): указатель `X-Wetop-Scope` проверяется здесь, до обработчика, в контексте
 * организации вошедшего — под RLS выборки режет и база. Без указателя в базу не ходим: у Luxx указателя нет, лишнего
 * рейса тоже.
 *
 * Запрос без сессии — сторож, фоновая задача, скрипт сверки: у их записей автора нет, и это верно; указатель им не нужен.
 */
@Injectable()
export class AuthorInterceptor implements NestInterceptor {
  // База нужна только для проверки указателя. Модуль без неё (тестовые сборки контроллеров) указатель не проверит —
  // тогда scope организации: он уже, чем любой выбор, права не расширяются
  constructor(@Optional() @Inject(PrismaService) private readonly prisma?: PrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<{
      user?: SignedInUser;
      headers?: Record<string, string | string[] | undefined>;
    }>();
    const actor = {
      userId: request?.user?.id ?? null,
      // Организация вошедшего — то, по чему видно, чей объект открывать (ADR-061)
      organizationId: request?.user?.organizationId ?? null,
      // роль и отметка главного администратора — для прав владельца и раздела «Платформа» (ADR-083)
      role: request?.user?.role ?? null,
      platformAdmin: request?.user?.platformAdmin === true,
    };
    const scope = await this.scope(actor, request?.headers?.[SCOPE_HEADER]);
    const value = await withSignedInUser({ ...actor, ...scope }, () =>
      lastValueFrom(next.handle(), { defaultValue: undefined }),
    );
    return from([value]);
  }

  private async scope(
    actor: { userId: string | null; organizationId: string | null },
    header: string | string[] | undefined,
  ): Promise<ResolvedScope | Record<string, never>> {
    if (!actor.userId || !actor.organizationId) return {};
    const pointer = parseScopePointer(header);
    if (!pointer.businessId && !pointer.locationId) return { scope: 'ORGANIZATION' };
    const prisma = this.prisma;
    if (!prisma) return { scope: 'ORGANIZATION' };
    const organizationId = actor.organizationId;
    return withSignedInUser(actor, () => resolveScope(prisma.db, organizationId, pointer));
  }
}
