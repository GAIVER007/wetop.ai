import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@pms/domain';

/**
 * Право маршрута (ADR-106, DATA_MODEL §16.5). Кроме прав ролей — два особых случая: `platform` — раздел главного
 * администратора (§16.2), от роли в организации не зависит; `service` — только служебный ключ, вошедшему человеку закрыт.
 */
export type RouteAccess = Permission | 'platform' | 'service';

export const ROUTE_ACCESS = 'wetop:route-access';

/**
 * Метка права на метод или весь контроллер; у метода — сильнее. Проверяет её `RoleGuard`. Маршрут без `@Access` и без
 * `@Public` вошедшему закрыт, а тест `route-access.test.ts` такой маршрут не пропустит.
 */
export const Access = (access: RouteAccess) => SetMetadata(ROUTE_ACCESS, access);
