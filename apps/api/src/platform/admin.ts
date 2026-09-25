import { ForbiddenException } from '@nestjs/common';
import { actorIsPlatformAdmin } from '../auth/request-context';

export const PLATFORM_ADMIN_ONLY =
  'Раздел «Платформа» — только для главного администратора платформы';

/**
 * Раздел «Платформа» (DATA_MODEL §16.2, ADR-083) — только вошедшему с отметкой `platform_admins`: служебные ключи и
 * выключенный замок (`AUTH_REQUIRED=0`) его не открывают. Проверка — до любого вызова бота и до записи в базу.
 */
export function requirePlatformAdmin(): void {
  if (!actorIsPlatformAdmin()) throw new ForbiddenException(PLATFORM_ADMIN_ONLY);
}
