import { ForbiddenException } from '@nestjs/common';
import type { Db } from '@pms/database';
import { currentOrganizationId, hasSignedInActor } from '../auth/request-context';

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
  /** Чья это гостиница (ADR-061). `null` — ничья: видна только служебным ходокам. */
  organizationId: string | null;
}

/**
 * Что видит вошедший не из той организации. Текст не говорит, что объект существует и чей он:
 * посторонний не должен по ответу узнавать, что за этой установкой стоит гостиница.
 */
export const FOREIGN_PROPERTY_MESSAGE =
  'Объект не настроен для вашей организации. Обратитесь к владельцу объекта.';

/**
 * Замок разделения данных (ADR-061). Стоит в единственном месте, где имя объекта превращается в его
 * идентификатор: всё остальное — шахматка, брони, тарифы, сверка — начинает запрос отсюда, и потому
 * ни один репозиторий для этого не переписывается.
 *
 * Служебные ходоки (скрипты владельца, сторож, импорт) проходят: за ними нет человека, они и есть
 * владелец. Вошедший человек проходит только к объекту своей организации.
 */
export function assertPropertyVisible(property: PropertyRef): void {
  if (!hasSignedInActor()) return;
  const organizationId = currentOrganizationId();
  if (organizationId !== null && property.organizationId === organizationId) return;
  throw new ForbiddenException(FOREIGN_PROPERTY_MESSAGE);
}

const cache = new Map<string, PropertyRef>();
const schema = (): string => process.env.DATABASE_SCHEMA?.trim() || 'public';

export async function propertyRef(db: Db, name: string): Promise<PropertyRef> {
  const key = `${schema()}|${name}`;
  const known = cache.get(key);
  if (known) {
    assertPropertyVisible(known);
    return known;
  }
  // `findFirst`, а не `findFirstOrThrow`: так же читают объект остальные места, и подделки в тестах
  // не приходится учить второму методу. Отсутствие объекта — это «база ещё не настроена».
  const found = await db.property.findFirst({
    where: { name },
    select: { id: true, name: true, organizationId: true },
  });
  if (!found) throw new Error(`Объект «${name}» не найден: база ещё не настроена`);
  cache.set(key, found);
  // Проверка после запоминания: чужой организации отказываем, но второй рейс в базу за тем же
  // объектом не делаем — иначе отказ стоил бы дороже успеха.
  assertPropertyVisible(found);
  return found;
}

export async function propertyIdRef(db: Db, name: string): Promise<string> {
  return (await propertyRef(db, name)).id;
}

/** Забыть запомненное: тесты и случай, когда объект пересоздали. */
export function forgetPropertyRef(): void {
  cache.clear();
}
