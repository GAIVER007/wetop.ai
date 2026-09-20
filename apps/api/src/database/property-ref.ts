import type { Db } from '@pms/database';

/**
 * Идентификатор объекта: один запрос на процесс, а не на каждый рейс в базу.
 *
 * 16.09.2026, разбор «всё тормозит»: `property.findFirst({ where: { name } })` стоял в девяти
 * репозиториях и выполнялся при каждом обращении. Дашборд платил этот рейс восемь раз за один
 * запрос (2 периода × 4 выборки), шахматка — трижды. База в Сингапуре, стойка в Алматы: каждый рейс
 * это десятки миллисекунд, и на пустом месте набегали секунды.
 *
 * Объект один и на ходу не переименовывается (ADR-013, SaaS — шаги 2–4 среза 13), поэтому ответ
 * держим в памяти. Ключ — имя объекта плюс схема базы: прогон в `pms_test` не должен получить id
 * рабочих данных (ADR-042). Отказ не запоминается: базу могли ещё не настроить.
 */
interface PropertyRef {
  id: string;
  name: string;
}

const cache = new Map<string, PropertyRef>();
const schema = (): string => process.env.DATABASE_SCHEMA?.trim() || 'public';

export async function propertyRef(db: Db, name: string): Promise<PropertyRef> {
  const key = `${schema()}|${name}`;
  const known = cache.get(key);
  if (known) return known;
  // `findFirst`, а не `findFirstOrThrow`: так же читают объект остальные места, и подделки в тестах
  // не приходится учить второму методу. Отсутствие объекта — это «база ещё не настроена».
  const found = await db.property.findFirst({
    where: { name },
    select: { id: true, name: true },
  });
  if (!found) throw new Error(`Объект «${name}» не найден: база ещё не настроена`);
  cache.set(key, found);
  return found;
}

export async function propertyIdRef(db: Db, name: string): Promise<string> {
  return (await propertyRef(db, name)).id;
}

/** Забыть запомненное: тесты и случай, когда объект пересоздали. */
export function forgetPropertyRef(): void {
  cache.clear();
}
