import 'reflect-metadata';
import {
  ForbiddenException,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { withServiceDatabase } from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';
import { channelOperatorOrganizationId } from './operator-access';

export const INTEGRATION_ONLY =
  'Каналы доступны только сотрудникам своей организации с разрешением на этот раздел.';

type Actor = { organizationId: string; platformAdmin?: boolean };

/** Whether an organization has at least one mapped Channex property. Used for diagnostics. */
export async function isIntegrationActor(prisma: PrismaService, actor: Actor): Promise<boolean> {
  if (actor.platformAdmin === true) return true;
  return withServiceDatabase(async () =>
    Boolean(
      await prisma.db.channelMapping.findFirst({
        where: { provider: 'channex', property: { organizationId: actor.organizationId } },
        select: { id: true },
      }),
    ),
  );
}

/** A new organization must be able to open setup before it has any Channex mapping. */
@Injectable()
export class ChannelOrganizationGuard implements CanActivate {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const user = context.switchToHttp().getRequest<{ user?: Actor }>().user;
    if (!user || user.platformAdmin === true) return true;
    const ownProperty = await this.prisma.db.property.findFirst({
      where: { organizationId: user.organizationId },
      select: { id: true },
    });
    if (ownProperty) return true;
    throw new ForbiddenException(INTEGRATION_ONLY);
  }
}

/** Global incidents have no tenant field. Keep their access limited to the original single installation. */
@Injectable()
export class IntegrationOwnerGuard implements CanActivate {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const user = context.switchToHttp().getRequest<{ user?: Actor }>().user;
    if (!user || user.platformAdmin === true) return true;
    const owner = await withServiceDatabase(() => channelOperatorOrganizationId(this.prisma.db));
    if (owner !== null && owner === user.organizationId) return true;
    throw new ForbiddenException(
      'Глобальная диагностика системы доступна главному администратору.',
    );
  }
}
