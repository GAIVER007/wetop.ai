/**
 * `INTEGRATION_PROPERTY_ID` — идентификатор объекта установки, к которому подключён Channex (SEC-2, аудит 29.09.2026).
 * Раньше «чей это объект» определялось по названию «Luxx Aparts»: самый ранний объект с этим именем. Пока запись Luxx
 * есть, она выигрывала; если её нет или переименовали, первый зарегистрировавшийся с таким названием становился
 * оператором интеграции. Идентификатор не зависит от названия.
 */
export type IntegrationIdSetting =
  { kind: 'unset' } | { kind: 'id'; id: string } | { kind: 'invalid' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Что задано в окружении: не задано (пусто), верный UUID или что-то другое (настройка неверна) */
export function integrationIdSetting(
  env: Record<string, string | undefined> = process.env,
): IntegrationIdSetting {
  const value = env['INTEGRATION_PROPERTY_ID']?.trim();
  if (!value) return { kind: 'unset' };
  return UUID.test(value) ? { kind: 'id', id: value.toLowerCase() } : { kind: 'invalid' };
}
