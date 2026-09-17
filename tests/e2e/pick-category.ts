import { expect, type APIRequestContext } from '@playwright/test';

/**
 * Категория для брони — как её выбирает администратор, а не по коду объекта.
 *
 * Спеки выбирали категорию кодом настоящего объекта (`exely-5074688` — «Общая мужская комната»):
 * на любом другом стенде такой опции нет, и спек ждёт её до таймаута. Смена так не работает: она
 * смотрит, где на эти даты есть места, и берёт ту категорию. Здесь то же самое — через тот же
 * `GET /availability`, что читает экран доступности: берём категорию с наибольшим запасом мест.
 * На объекте это общая комната (36 коек), на любом стенде — самая свободная категория.
 */
interface Availability {
  byCategory: Record<string, { units: number; available: number; availableUnitCodes: string[] }>;
}

const api = () => process.env['E2E_API_URL'] ?? process.env['APP_API_URL'] ?? '';

/** Код категории, где на эти даты больше всего свободных мест; `minFree` — сколько нужно наверняка. */
export async function roomiestCategory(
  request: APIRequestContext,
  arrival: string,
  departure: string,
  minFree = 1,
): Promise<string> {
  const res = await request.get(
    `${api()}/availability?arrival=${encodeURIComponent(arrival)}&departure=${encodeURIComponent(departure)}`,
  );
  expect(res.ok(), `availability ${arrival}…${departure}: HTTP ${res.status()}`).toBe(true);
  const body = (await res.json()) as Availability;
  const best = Object.entries(body.byCategory).sort((a, b) => b[1].available - a[1].available)[0];
  expect(best, `на ${arrival}…${departure} нет ни одной категории`).toBeTruthy();
  expect(
    best![1].available,
    `на ${arrival}…${departure} свободно ${best![1].available}, нужно ${minFree}`,
  ).toBeGreaterThanOrEqual(minFree);
  return best![0];
}

interface HotelSettings {
  ratePlans: Array<{ code: string; name: string; cancellationPenalty: string }>;
}

/**
 * Тариф с нужной политикой штрафа (Q-103). Спек брал код тарифа объекта; на другом стенде такого
 * нет. Политика лежит в настройках гостиницы — тем же чтением, что у экрана «Настройки».
 */
export async function ratePlanWithPenalty(
  request: APIRequestContext,
  penalty: 'NONE' | 'FIRST_NIGHT' | 'FULL_STAY',
): Promise<string> {
  const res = await request.get(`${api()}/hotel/settings`);
  expect(res.ok(), `hotel/settings: HTTP ${res.status()}`).toBe(true);
  const { ratePlans } = (await res.json()) as HotelSettings;
  const plan = ratePlans.find((p) => p.cancellationPenalty === penalty);
  expect(plan, `нет тарифа с политикой ${penalty}: ${ratePlans.map((p) => p.code).join(', ')}`).toBeTruthy();
  return plan!.code;
}
