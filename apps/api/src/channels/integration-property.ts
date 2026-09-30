import type { Db } from '@pms/database';
import { LUXX_APARTS_PROPERTY } from '@pms/domain';
import { integrationIdSetting } from '../database/integration-property-id';

/**
 * Объект установки, к которому подключён Channex (SEC-2, аудит 29.09.2026). Три источника, по убыванию надёжности:
 *
 * 1. `INTEGRATION_PROPERTY_ID` — идентификатор, заданный владельцем. Задан — решает он один: нет такого объекта или
 *    значение не UUID — объект ничей (закрыто), к сопоставлениям и названию не откатываемся.
 * 2. Сопоставления Channex (`channel_mappings.property_id`): создавать их может только оператор интеграции.
 * 3. Прежний путь — самый ранний объект с названием установки (С-2). Остаётся, пока идентификатор не задан: на нём
 *    держатся установки, где `INTEGRATION_PROPERTY_ID` ещё не вписан; при старте production предупреждает об этом.
 *
 * Вопрос про всю установку: вызывать служебной ролью базы (под `wetop_app` чужие объекты не видны, RLS §17).
 */
export type IntegrationPropertySource = 'env' | 'mapping' | 'name';
export interface IntegrationProperty {
  id: string;
  organizationId: string | null;
  source: IntegrationPropertySource;
}

let warnedAboutName = false;

export async function resolveIntegrationProperty(
  db: Db,
  env: Record<string, string | undefined> = process.env,
): Promise<IntegrationProperty | null> {
  const setting = integrationIdSetting(env);
  if (setting.kind === 'invalid') return null;
  if (setting.kind === 'id') {
    const property = await db.property.findUnique({
      where: { id: setting.id },
      select: { id: true, organizationId: true },
    });
    return property ? { ...property, source: 'env' } : null;
  }
  const mapping = await db.channelMapping.findFirst({
    where: { provider: 'channex' },
    orderBy: { createdAt: 'asc' },
    select: { property: { select: { id: true, organizationId: true } } },
  });
  if (mapping) return { ...mapping.property, source: 'mapping' };
  const byName = await db.property.findFirst({
    where: { name: LUXX_APARTS_PROPERTY.name },
    orderBy: { createdAt: 'asc' },
    select: { id: true, organizationId: true },
  });
  if (!byName) return null;
  if (env['NODE_ENV'] === 'production' && !warnedAboutName) {
    warnedAboutName = true;
    console.warn(
      'Объект интеграции определён по названию: задайте INTEGRATION_PROPERTY_ID (docs/deploy.md), название на выбор не влияет',
    );
  }
  return { ...byName, source: 'name' };
}

/** Сообщение при старте API в production: `warn` — только предупредить, `error` — настройка неверна */
export function integrationBindingNotice(
  env: Record<string, string | undefined>,
): { level: 'warn' | 'error'; message: string } | null {
  if (env['NODE_ENV'] !== 'production') return null;
  const setting = integrationIdSetting(env);
  if (setting.kind === 'id') return null;
  if (setting.kind === 'invalid')
    return {
      level: 'error',
      message:
        'INTEGRATION_PROPERTY_ID задан не UUID: объект интеграции не определить. Впишите идентификатор объекта установки (docs/deploy.md)',
    };
  return {
    level: 'warn',
    message:
      'INTEGRATION_PROPERTY_ID не задан: объект интеграции с менеджером каналов определяется по сопоставлениям, а пока их нет — по названию объекта. Впишите идентификатор объекта установки (docs/deploy.md)',
  };
}
