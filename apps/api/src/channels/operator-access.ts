import 'reflect-metadata';
import {
  ForbiddenException,
  Inject,
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { from, lastValueFrom, type Observable } from 'rxjs';
import type { Db } from '@pms/database';
import { LUXX_APARTS_PROPERTY } from '@pms/domain';
import { PUBLIC_ROUTE } from '../auth/public.decorator';
import {
  actorIsPlatformAdmin,
  currentOrganizationId,
  hasSignedInActor,
  withServiceDatabase,
  withSignedInUser,
} from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';

export const CHANNEL_OPERATOR_FOREIGN_MESSAGE =
  'Каналы и сторож этой установки работают с объектом другой организации. Обратитесь в поддержку WETOP.';

/**
 * Организация, чей объект подключён к Channex: по сопоставлениям (`channel_mappings.property_id`), а пока их нет —
 * объект установки по имени, самый ранний (С-2). `null` — объект ничей: такой видят только служебные ходоки.
 */
export async function channelOperatorOrganizationId(db: Db): Promise<string | null> {
  const mapping = await db.channelMapping.findFirst({
    where: { provider: 'channex' },
    orderBy: { createdAt: 'asc' },
    select: { property: { select: { organizationId: true } } },
  });
  if (mapping) return mapping.property.organizationId;
  const property = await db.property.findFirst({
    where: { name: LUXX_APARTS_PROPERTY.name },
    orderBy: { createdAt: 'asc' },
    select: { organizationId: true },
  });
  return property?.organizationId ?? null;
}

/**
 * Доступ к маршрутам Channex и сторожа (аудит 26.09 В-2, С-3; Q-193, ADR-095). Подключение Channex и таблица
 * неисправностей — одни на установку, а раньше ими распоряжался любой вошедший: сотрудник другой гостиницы разбирал
 * ревизии Luxx в контексте своего объекта (отмена брони терялась безвозвратно), видел журнал событий и «принимал»
 * тревоги овербукинга.
 *
 * Пропускает: публичный маршрут (webhook Channex со своим секретом), служебный ключ, организацию, чей объект подключён.
 * Главный администратор другой организации работает в служебном контексте: иначе разбор ревизий ушёл бы в объект его
 * собственной организации. Остальным — 403 до обработчика.
 */
@Injectable()
export class ChannelOperatorInterceptor implements NestInterceptor {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic || !hasSignedInActor()) return next.handle();

    // Кто оператор — вопрос про всю установку, а не про организацию вошедшего: под ролью организации (RLS,
    // DATA_MODEL §17) чужих сопоставлений не видно, и ответ был бы «оператор неизвестен» или «ты сам»
    const operator = await withServiceDatabase(() => channelOperatorOrganizationId(this.prisma.db));
    if (operator !== null && currentOrganizationId() === operator) return next.handle();
    if (actorIsPlatformAdmin()) {
      return from(
        withSignedInUser(null, () => lastValueFrom(next.handle(), { defaultValue: undefined })),
      );
    }
    throw new ForbiddenException(CHANNEL_OPERATOR_FOREIGN_MESSAGE);
  }
}
