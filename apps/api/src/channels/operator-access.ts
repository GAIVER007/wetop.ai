import 'reflect-metadata';
import {
  Inject,
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Db } from '@pms/database';
import { LUXX_APARTS_PROPERTY } from '@pms/domain';
import type { Observable } from 'rxjs';
import { PUBLIC_ROUTE } from '../auth/public.decorator';
import { hasSignedInActor } from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';
import { propertyRef } from '../database/property-ref';
import { mappedChannexProperties } from './mapped-properties';

export const CHANNEL_OPERATOR_FOREIGN_MESSAGE =
  'Выбранный филиал не принадлежит вашей организации.';

/** Legacy diagnostic for a single-property installation. Multiple owners have no global operator. */
export async function channelOperatorOrganizationId(db: Db): Promise<string | null> {
  const mappings = await mappedChannexProperties(db);
  if (mappings.length !== 1) return null;
  const property = await db.property.findUnique({
    where: { id: mappings[0]!.localPropertyId },
    select: { organizationId: true },
  });
  return property?.organizationId ?? null;
}

/** Resolve the validated branch scope before executing an operator route. */
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
    if (!isPublic && hasSignedInActor())
      await propertyRef(this.prisma.db, LUXX_APARTS_PROPERTY.name);
    return next.handle();
  }
}
