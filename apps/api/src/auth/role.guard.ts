import 'reflect-metadata';
import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ORGANIZATION_LEVEL_PERMISSIONS,
  RESTRICTED_ORGANIZATION_MESSAGE,
  accessDeniedMessage,
  can,
  isRestricted,
} from '@pms/domain';
import { PLATFORM_ADMIN_ONLY } from '../platform/admin';
import { ROUTE_ACCESS, type RouteAccess } from './access.decorator';
import type { SignedInUser } from './auth.service';
import { ORGANIZATION_LEVEL_ROUTE } from './organization-level.decorator';
import { PUBLIC_ROUTE } from './public.decorator';
import { BEAUTY_ACCESS, type BeautyRequirement } from '../beauty/access.decorator';

export const SERVICE_KEY_ONLY = 'Этот адрес — только для служебного ключа, не для входа человека';
export const ROUTE_WITHOUT_ACCESS = 'У этого адреса не записано, кому он открыт: доступ закрыт';

/**
 * Замок ролей (ADR-107, DATA_MODEL §16.5). Стоит сразу за замком входа (`SessionGuard`): тот узнаёт человека по сессии и
 * кладёт его в `request.user`, этот сверяет роль с правом маршрута (`@Access`). Отказ — 403 с названием раздела.
 *
 * Без человека за запросом — служебный ключ, сторож, замок выключен в разработке — ролей не проверяют: такой ходок и
 * раньше был владельцем объекта (ADR-061, ADR-083); решает, пускать ли его вообще, замок входа.
 */
@Injectable()
export class RoleGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, targets)) return true;

    const user = context.switchToHttp().getRequest<{ user?: SignedInUser }>().user;
    if (!user) return true;

    const access = this.reflector.getAllAndOverride<RouteAccess | undefined>(ROUTE_ACCESS, targets);
    // не знаем, кому открыт, — закрыт; тест route-access.test.ts не даёт такому маршруту появиться
    if (!access) throw new ForbiddenException(ROUTE_WITHOUT_ACCESS);
    if (access === 'platform') {
      if (user.platformAdmin === true) return true;
      throw new ForbiddenException(PLATFORM_ADMIN_ONLY);
    }
    if (access === 'service') throw new ForbiddenException(SERVICE_KEY_ONLY);
    const restricted = isRestricted(user.role, user.scopes ?? []);
    // маршрут с данными организации или бизнеса, а не филиала (гости, запись каталога): право общее со стойкой или
    // с филиальной ролью, поэтому закрыт меткой. Проверяется раньше разбора Beauty: тот отдаёт решение роли в филиале
    const organizationLevel = restricted
      ? this.reflector.getAllAndOverride<string | undefined>(ORGANIZATION_LEVEL_ROUTE, targets)
      : undefined;
    if (organizationLevel) throw new ForbiddenException(organizationLevel);
    const beauty = this.reflector.getAllAndOverride<BeautyRequirement | undefined>(BEAUTY_ACCESS, targets);
    // Exact action is checked after the business pointer has been verified by AuthorInterceptor.
    if (beauty && !beauty.managerOnly && access !== 'owner') return true;
    // человеку с областью доступа организационные разделы закрыты, какая бы роль у него ни была в филиале (§31.1)
    if (restricted && ORGANIZATION_LEVEL_PERMISSIONS.includes(access))
      throw new ForbiddenException(RESTRICTED_ORGANIZATION_MESSAGE);
    if (can(user.role, access)) return true;
    throw new ForbiddenException(accessDeniedMessage(access));
  }
}
