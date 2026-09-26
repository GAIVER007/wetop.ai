import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Db } from '@pms/database';
import { todayAt } from '@pms/domain';
import { actsForOrganization, currentOrganizationId } from '../auth/request-context';

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
  /** IANA-пояс объекта: «сегодня» и границы суток считаются по нему (С-13, ТЗ аудита 25.09.2026) */
  timezone: string;
}

/**
 * Что видит вошедший не из той организации. Текст не говорит, что объект существует и чей он:
 * посторонний не должен по ответу узнавать, что за этой установкой стоит гостиница.
 */
export const FOREIGN_PROPERTY_MESSAGE =
  'Объект не настроен для вашей организации. Обратитесь к владельцу объекта.';

/** У организации вошедшего ещё нет объекта. При регистрации он создаётся, так что это редкий случай. */
export const PROPERTY_NOT_SET_UP_MESSAGE =
  'У вашей организации ещё нет объекта. Создайте его в настройках.';

/**
 * Замок разделения данных (ADR-061). Стоит в единственном месте, где имя объекта превращается в его
 * идентификатор: всё остальное — шахматка, брони, тарифы, сверка — начинает запрос отсюда, и потому
 * ни один репозиторий для этого не переписывается.
 *
 * Служебные ходоки (скрипты владельца, сторож, импорт) проходят: за ними нет человека, они и есть
 * владелец. Вошедший человек проходит только к объекту своей организации.
 */
export function assertPropertyVisible(property: PropertyRef): void {
  if (!actsForOrganization()) return;
  const organizationId = currentOrganizationId();
  if (organizationId !== null && property.organizationId === organizationId) return;
  throw new ForbiddenException(FOREIGN_PROPERTY_MESSAGE);
}

const cache = new Map<string, PropertyRef>();
const schema = (): string => process.env.DATABASE_SCHEMA?.trim() || 'public';

export async function propertyRef(db: Db, name: string): Promise<PropertyRef> {
  // Мультитенантность (решение владельца 21.09.2026). Вошедший человек видит только объект СВОЕЙ
  // организации — какое бы имя ни просил репозиторий (все просят имя единственного прежде объекта).
  // Это тот же замок ADR-061, перенесённый в саму выборку: подставить чужой объект нельзя, потому
  // что имя больше не участвует в выборке для человека. Служебный ходок (сторож, скрипт, импорт,
  // публичный виджет) человека за собой не имеет и по-прежнему берёт объект по имени.
  if (actsForOrganization()) return organizationPropertyRef(db);

  const key = `${schema()}|name|${name}`;
  const known = cache.get(key);
  if (known) return known;
  // `findFirst`, а не `findFirstOrThrow`: так же читают объект остальные места, и подделки в тестах
  // не приходится учить второму методу. Отсутствие объекта — это «база ещё не настроена».
  // Самый старый объект с этим именем: регистрация тёзок не пускает, но и без неё выбор не зависит от порядка строк
  const found = await db.property.findFirst({
    where: { name },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, organizationId: true, timezone: true },
  });
  if (!found) throw new Error(`Объект «${name}» не найден: база ещё не настроена`);
  cache.set(key, found);
  return found;
}

/**
 * Объект организации вошедшего. Выборка идёт прямо по `organizationId`, поэтому чужой объект сюда
 * не попадает по построению, а не по проверке после. Кэш — по организации плюс схема базы (ADR-042).
 */
async function organizationPropertyRef(db: Db): Promise<PropertyRef> {
  const organizationId = currentOrganizationId();
  // Вошедший без организации (членства нет) не видит ни одного объекта — как и должен.
  if (organizationId === null) throw new ForbiddenException(FOREIGN_PROPERTY_MESSAGE);
  const key = `${schema()}|org|${organizationId}`;
  const known = cache.get(key);
  if (known) return known;
  const found = await db.property.findFirst({
    where: { organizationId },
    select: { id: true, name: true, organizationId: true, timezone: true },
  });
  if (!found) throw new NotFoundException(PROPERTY_NOT_SET_UP_MESSAGE);
  cache.set(key, found);
  return found;
}

export async function propertyIdRef(db: Db, name: string): Promise<string> {
  return (await propertyRef(db, name)).id;
}

/** «Сегодня» по часам объекта — из того же кэша, что id (С-13): без лишнего рейса в базу. */
export async function propertyToday(db: Db, name: string): Promise<string> {
  return todayAt((await propertyRef(db, name)).timezone);
}

/** Забыть запомненное: тесты и случай, когда объект пересоздали. */
export function forgetPropertyRef(): void {
  cache.clear();
}
