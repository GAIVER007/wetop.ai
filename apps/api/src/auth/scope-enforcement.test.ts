import 'reflect-metadata';
import { Controller, ForbiddenException, Get } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import {
  RESTRICTED_ORGANIZATION_MESSAGE,
  SCOPE_CHOOSE_MESSAGE,
  SCOPE_FORBIDDEN_MESSAGE,
  type ScopeAssignment,
} from '@pms/domain';
import { Access } from './access.decorator';
import { AuthorInterceptor } from './author.interceptor';
import { RoleGuard } from './role.guard';
import { ScopeAware } from './scope-aware.decorator';
import { currentAssignments, currentLocationId, currentRole } from './request-context';
import type { SignedInUser } from './auth.service';

/**
 * Принуждение области доступа (DATA_MODEL §31.1, ADR-156, STAFF2.3b S3): человек с назначениями работает только в своих
 * бизнесах и филиалах и с ролью этого места; организационные разделы ему закрыты. Проверяется сервером, а не стойкой.
 */
const ORG = 'org-luxx';
const B = '11111111-1111-4111-8111-111111111111';
const L1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const L2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';

const prisma = {
  db: {
    business: {
      findFirst: async ({ where }: { where: { id: string; organizationId: string } }) =>
        where.id === B && where.organizationId === ORG ? { id: B, vertical: 'HOSPITALITY' } : null,
    },
    location: {
      findFirst: async ({ where }: { where: { id: string; businessId: string } }) =>
        [L1, L2].includes(where.id) && where.businessId === B ? { id: where.id } : null,
    },
  },
} as never;

@Controller('demo')
class Demo {
  @Get('board') @Access('desk') board() {}
  @Get('refund') @Access('refunds') refund() {}
  @Get('me') @Access('self') me() {}
  @Get('list') @Access('desk') @ScopeAware() list() {}
  @Get('team') @Access('staff') team() {}
}

const user = (role: SignedInUser['role'], scopes?: ScopeAssignment[]) =>
  ({
    id: 'u-1',
    organizationId: ORG,
    role,
    platformAdmin: false,
    ...(scopes ? { scopes } : {}),
  }) as SignedInUser;
const at = (location?: string) =>
  location ? { 'x-wetop-scope': `business=${B};location=${location}` } : {};
const ctx = (method: keyof Demo, u: SignedInUser, headers: Record<string, string>) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user: u, headers }) }),
    getHandler: () => Demo.prototype[method],
    getClass: () => Demo,
  }) as never;

/** Выполнить маршрут через перехватчик; вернуть, что увидел обработчик */
async function run(method: keyof Demo, u: SignedInUser, headers: Record<string, string>) {
  const seen: { role: string | null; location: string | null; scopes: number } = {
    role: null,
    location: null,
    scopes: -1,
  };
  const next = {
    handle: () => {
      seen.role = currentRole();
      seen.location = currentLocationId();
      seen.scopes = currentAssignments().length;
      return of('ok');
    },
  };
  await new AuthorInterceptor(prisma).intercept(ctx(method, u, headers), next as never);
  await new Promise((r) => setTimeout(r, 0));
  return seen;
}

const staffAtL1: ScopeAssignment[] = [{ role: 'STAFF', businessId: B, locationId: L1 }];
const mixed: ScopeAssignment[] = [
  { role: 'MANAGER', businessId: B, locationId: L1 },
  { role: 'STAFF', businessId: B, locationId: L2 },
];

describe('перехватчик: область доступа', () => {
  it('в своём филиале работает с ролью назначения', async () => {
    const seen = await run('board', user('STAFF', staffAtL1), at(L1));
    expect(seen).toEqual({ role: 'STAFF', location: L1, scopes: 1 });
  });

  it('в чужом филиале организации: 403, обработчик не выполнен', async () => {
    await expect(run('board', user('STAFF', staffAtL1), at(L2))).rejects.toThrow(
      new ForbiddenException(SCOPE_FORBIDDEN_MESSAGE),
    );
  });

  it('без выбранного филиала: 403 «выберите», личные маршруты открыты', async () => {
    await expect(run('board', user('STAFF', staffAtL1), at())).rejects.toThrow(
      new ForbiddenException(SCOPE_CHOOSE_MESSAGE),
    );
    expect((await run('me', user('STAFF', staffAtL1), at())).scopes).toBe(1);
  });

  it('маршрут с меткой ScopeAware (выбор филиала, сводка) выполняется без выбора', async () => {
    expect((await run('list', user('STAFF', staffAtL1), at())).scopes).toBe(1);
  });

  it('роль в филиале решает права: администратор филиала не делает возврат, управляющий того же человека делает', async () => {
    await expect(run('refund', user('MANAGER', mixed), at(L2))).rejects.toThrow(ForbiddenException);
    const ok = await run('refund', user('MANAGER', mixed), at(L1));
    expect(ok.role).toBe('MANAGER');
    // в другом филиале тот же человек остаётся администратором
    expect((await run('board', user('MANAGER', mixed), at(L2))).role).toBe('STAFF');
  });

  it('без назначений и у владельца ничего не меняется', async () => {
    expect((await run('board', user('STAFF'), at())).role).toBe('STAFF');
    expect((await run('refund', user('MANAGER'), at())).role).toBe('MANAGER');
    expect((await run('board', user('OWNER', staffAtL1), at(L2))).role).toBe('OWNER');
  });
});

describe('замок ролей: организационные разделы закрыты человеку с областью', () => {
  const guard = new RoleGuard(new Reflector());
  const can = (method: keyof Demo, u: SignedInUser) =>
    guard.canActivate({
      getHandler: () => Demo.prototype[method],
      getClass: () => Demo,
      switchToHttp: () => ({ getRequest: () => ({ user: u }) }),
    } as never);

  it('управляющий без ограничения ведёт команду, с областью нет', () => {
    expect(can('team', user('MANAGER'))).toBe(true);
    expect(() => can('team', user('MANAGER', mixed))).toThrow(
      new ForbiddenException(RESTRICTED_ORGANIZATION_MESSAGE),
    );
  });

  it('обычные разделы замок не трогает: место проверит перехватчик', () => {
    expect(can('board', user('STAFF', staffAtL1))).toBe(true);
  });
});
