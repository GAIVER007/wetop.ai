import 'reflect-metadata';
import {
  ForbiddenException,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { LUXX_APARTS_PROPERTY } from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';

export const INTEGRATION_ONLY =
  'Каналы продаж, обмен с Channex и сторож системы ведёт поддержка WETOP: раздел открыт гостинице, к которой ' +
  'подключены каналы, и главному администратору.';

type Actor = { organizationId: string; platformAdmin?: boolean };

/**
 * Организация объекта, к которому подключена интеграция Channex (Luxx): тот же выбор, что у служебных путей API —
 * самый старый объект с этим именем. Держим минуту: гард стоит на каждом запросе разделов каналов и сторожа.
 */
const known = new WeakMap<PrismaService, { at: number; organizationId: string | null }>();
async function integrationOrganizationId(prisma: PrismaService): Promise<string | null> {
  const hit = known.get(prisma);
  if (hit && Date.now() - hit.at < 60_000) return hit.organizationId;
  const property = await prisma.db.property.findFirst({
    where: { name: LUXX_APARTS_PROPERTY.name },
    orderBy: { createdAt: 'asc' },
    select: { organizationId: true },
  });
  const organizationId = property?.organizationId ?? null;
  known.set(prisma, { at: Date.now(), organizationId });
  return organizationId;
}

/** Открыта ли вошедшему интеграция: главный администратор или организация объекта интеграции */
export async function isIntegrationActor(prisma: PrismaService, actor: Actor): Promise<boolean> {
  if (actor.platformAdmin === true) return true;
  const owner = await integrationOrganizationId(prisma);
  return owner !== null && owner === actor.organizationId;
}

/**
 * Разделы, общие на всю платформу (план tenant-isolation-2026-09-26 п. 5, решение владельца 26.09.2026): интеграция
 * Channex и сторож. Без вошедшего (служебный ключ, публичный вебхук) решает глобальный `SessionGuard` — сюда такой
 * запрос приходит уже пропущенным.
 */
@Injectable()
export class IntegrationOwnerGuard implements CanActivate {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const user = context.switchToHttp().getRequest<{ user?: Actor }>().user;
    if (!user) return true;
    if (await isIntegrationActor(this.prisma, user)) return true;
    throw new ForbiddenException(INTEGRATION_ONLY);
  }
}
