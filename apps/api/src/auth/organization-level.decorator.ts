import { SetMetadata } from '@nestjs/common';
import { RESTRICTED_ORGANIZATION_MESSAGE } from '@pms/domain';

export const ORGANIZATION_LEVEL_ROUTE = 'wetop:organization-level-route';

/**
 * Данные маршрута принадлежат организации, а не филиалу (у сущности нет ключа филиала): человеку с областью доступа
 * (DATA_MODEL §31.1, ADR-156) он закрыт целиком, какой бы ни была его роль в филиале. Неограниченным (владелец, менеджер и
 * администратор без назначений) открыт как раньше: права роли решает `@Access`.
 *
 * Это узкая метка для маршрутов, у которых право `@Access` разделяют с филиальными данными (гости делят `desk` со всей
 * стойкой гостиницы). Целые организационные разделы закрываются правом: `ORGANIZATION_LEVEL_PERMISSIONS`. Проверяет её
 * `RoleGuard`. Решение владельца O3=A (CORE-SECURITY-FIX-01, 14.10.2026): гости гостиницы организационные.
 */
export const OrganizationLevel = (message: string = RESTRICTED_ORGANIZATION_MESSAGE) =>
  SetMetadata(ORGANIZATION_LEVEL_ROUTE, message);
