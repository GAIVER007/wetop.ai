import 'reflect-metadata';
import { NotFoundException, type CallHandler, type ExecutionContext } from '@nestjs/common';
import { INTERCEPTORS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { hasSignedInActor, withSignedInUser } from '../auth/request-context';
import { PUBLIC_ROUTE } from '../auth/public.decorator';
import { GuardController } from '../guard/guard.controller';
import { ChannelOperatorInterceptor } from './operator-access';
import { ChannelsController } from './channels.controller';
import { ChannelConnectionController } from './connection';
import { ChannelContentController } from './content';
import { forgetPropertyRef } from '../database/property-ref';

/**
 * Аудит 26.09, В-2 (Q-193, ADR-095) и С-3: маршруты Channex и сторожа были открыты любому вошедшему. Сотрудник второй
 * гостиницы нажимал «Забрать брони», и ревизии Luxx разбирались в контексте его объекта: отмена брони Luxx считалась
 * «брони нет», подтверждалась в Channex и терялась. Он же видел журнал событий, сопоставления, очередь ARI и
 * неисправности Luxx и мог «принять» тревогу овербукинга. Теперь — только организация, чей объект подключён к Channex,
 * и главный администратор; разбор у главного администратора другой организации — в служебном контексте.
 */
const OWNER_ORG = 'org-luxx';
const prisma = {
  db: {
    property: { findFirst: async ({ where }: { where: { location: { business: { organizationId: string } } } }) =>
      where.location.business.organizationId === 'org-without-property' ? null : ({
        id: where.location.business.organizationId,
        organizationId: where.location.business.organizationId,
        name: 'Same hotel', timezone: 'Asia/Almaty',
      }) },
  },
};

function context(isPublic = false): { ctx: ExecutionContext; reflector: Reflector } {
  const handler = () => undefined;
  class Cls {}
  if (isPublic) Reflect.defineMetadata(PUBLIC_ROUTE, true, handler);
  return {
    ctx: {
      getHandler: () => handler,
      getClass: () => Cls,
      switchToHttp: () => ({ getRequest: () => ({}) }),
    } as unknown as ExecutionContext,
    reflector: new Reflector(),
  };
}

/** Обработчик запоминает, в каком контексте его вызвали */
function handler(): { next: CallHandler; seen: { signedIn: boolean | null } } {
  const seen = { signedIn: null as boolean | null };
  return {
    seen,
    next: {
      handle: () => {
        seen.signedIn = hasSignedInActor();
        return of('ok');
      },
    },
  };
}

const run = async (
  actor: Parameters<typeof withSignedInUser>[0],
  isPublic = false,
): Promise<{ result: unknown; signedIn: boolean | null }> => {
  const { ctx, reflector } = context(isPublic);
  const interceptor = new ChannelOperatorInterceptor(reflector, prisma as never);
  const { next, seen } = handler();
  const result = await withSignedInUser(actor, async () =>
    lastValueFrom(await interceptor.intercept(ctx, next)),
  );
  return { result, signedIn: seen.signedIn };
};

describe('доступ к Channex и сторожу', () => {
  beforeEach(() => forgetPropertyRef());
  it('сотрудник организации, чей объект подключён, работает как прежде — от своего имени', async () => {
    await expect(run({ userId: 'u-1', organizationId: OWNER_ORG, role: 'STAFF' })).resolves.toEqual(
      { result: 'ok', signedIn: true },
    );
  });

  it('вторая организация работает только в своём контексте филиала', async () => {
    await expect(run({ userId: 'u-2', organizationId: 'org-b', role: 'OWNER' }))
      .resolves.toEqual({ result: 'ok', signedIn: true });
  });

  it('без своего филиала обработчик не запускается', async () => {
    const { ctx, reflector } = context();
    const interceptor = new ChannelOperatorInterceptor(reflector, prisma as never);
    const { next, seen } = handler();
    await expect(
      withSignedInUser({ userId: 'u-2', organizationId: 'org-without-property', role: 'OWNER' }, () =>
        interceptor.intercept(ctx, next),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(seen.signedIn).toBeNull();
  });

  it('главный администратор сохраняет подписанный контекст выбранного филиала', async () => {
    await expect(
      run({ userId: 'u-3', organizationId: 'org-wetop', role: 'OWNER', platformAdmin: true }),
    ).resolves.toEqual({ result: 'ok', signedIn: true });
  });

  it('служебный ключ и webhook Channex проходят без вопросов', async () => {
    await expect(run(null)).resolves.toMatchObject({ result: 'ok' });
    await expect(run({ userId: 'u-2', organizationId: 'org-b' }, true)).resolves.toMatchObject({
      result: 'ok',
    });
  });

  it('стоит на всех контроллерах Channex и на стороже', () => {
    for (const controller of [
      ChannelsController,
      ChannelConnectionController,
      ChannelContentController,
      GuardController,
    ]) {
      const interceptors = Reflect.getMetadata(INTERCEPTORS_METADATA, controller) ?? [];
      expect(interceptors, controller.name).toContain(ChannelOperatorInterceptor);
    }
  });
});
