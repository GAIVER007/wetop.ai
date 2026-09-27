import 'reflect-metadata';
import { Controller, ForbiddenException, Get } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import type { MembershipRole } from '@pms/domain';
import { Access } from './access.decorator';
import { Public } from './public.decorator';
import { RoleGuard, ROUTE_WITHOUT_ACCESS, SERVICE_KEY_ONLY } from './role.guard';
import { PLATFORM_ADMIN_ONLY } from '../platform/admin';

/**
 * Замок ролей (ADR-100, DATA_MODEL §16.5): у каждого маршрута записано право, роль вошедшего его либо даёт, либо нет.
 * Без человека за запросом (служебный ключ, замок выключен в разработке) ролей не проверяют — как и раньше.
 */
@Controller('demo')
@Access('desk')
class DemoController {
  @Get('board')
  board() {}

  @Get('rates')
  @Access('rates')
  rates() {}

  @Get('refund')
  @Access('refunds')
  refund() {}

  @Get('roles')
  @Access('owner')
  roles() {}

  @Get('platform')
  @Access('platform')
  platform() {}

  @Get('service')
  @Access('service')
  service() {}

  @Get('open')
  @Public()
  open() {}
}

@Controller('bare')
class BareController {
  @Get()
  bare() {}
}

const guard = new RoleGuard(new Reflector());

function run(
  handler: keyof DemoController | 'bare',
  user?: { role: MembershipRole | null; platformAdmin?: boolean },
): boolean {
  const cls = handler === 'bare' ? BareController : DemoController;
  const fn =
    handler === 'bare' ? BareController.prototype.bare : DemoController.prototype[handler];
  const request = {
    user: user && { id: 'u-1', organizationId: 'org-1', platformAdmin: false, ...user },
  };
  return guard.canActivate({
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => fn,
    getClass: () => cls,
  } as never) as boolean;
}

function refusal(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(ForbiddenException);
    return (e as ForbiddenException).message;
  }
  throw new Error('ожидался отказ 403');
}

describe('замок ролей', () => {
  it('без человека за запросом — пропускает: служебный ключ и замок без входа ролей не имеют', () => {
    for (const h of ['board', 'rates', 'refund', 'roles', 'service', 'bare'] as const)
      expect(run(h)).toBe(true);
  });

  it('публичный маршрут — пропускает любого', () => {
    expect(run('open', { role: 'STAFF' })).toBe(true);
    expect(run('open', { role: null })).toBe(true);
  });

  it('право у класса действует на все методы, право у метода — сильнее', () => {
    expect(run('board', { role: 'STAFF' })).toBe(true);
    expect(refusal(() => run('rates', { role: 'STAFF' }))).toBe(
      '«Тарифы и цены»: доступ есть у владельца и управляющего.',
    );
    expect(run('rates', { role: 'MANAGER' })).toBe(true);
  });

  it('администратор не делает возврат и сторно; управляющий и владелец — делают', () => {
    expect(refusal(() => run('refund', { role: 'STAFF' }))).toBe(
      '«Возврат оплаты и сторно»: доступ есть у владельца и управляющего.',
    );
    expect(run('refund', { role: 'MANAGER' })).toBe(true);
    expect(run('refund', { role: 'OWNER' })).toBe(true);
  });

  it('владельческое — только владельцу', () => {
    expect(run('roles', { role: 'OWNER' })).toBe(true);
    expect(refusal(() => run('roles', { role: 'MANAGER' }))).toBe(
      '«Управляющие, роли и платные расширения»: доступ есть только у владельца.',
    );
  });

  it('неизвестная роль не открывает ничего', () => {
    expect(() => run('board', { role: null })).toThrow(ForbiddenException);
  });

  it('«Платформа» — главному администратору, роль в организации её не открывает', () => {
    expect(refusal(() => run('platform', { role: 'OWNER' }))).toBe(PLATFORM_ADMIN_ONLY);
    expect(run('platform', { role: 'STAFF', platformAdmin: true })).toBe(true);
  });

  it('маршрут служебного ключа вошедшему закрыт', () => {
    expect(refusal(() => run('service', { role: 'OWNER' }))).toBe(SERVICE_KEY_ONLY);
  });

  it('маршрут без записанного права вошедшему закрыт: не знаем — закрыто', () => {
    expect(refusal(() => run('bare', { role: 'OWNER' }))).toBe(ROUTE_WITHOUT_ACCESS);
  });
});
