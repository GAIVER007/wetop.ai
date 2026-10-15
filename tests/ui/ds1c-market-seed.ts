import type { APIRequestContext } from '@playwright/test';
import { FIXTURE_API } from './fixtures';

const plus = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/** Два соседа на 14 ночей, чтобы у `/market` была таблица (тот же набор, что в `market.spec.ts`). */
export async function seedMarket(request: APIRequestContext): Promise<void> {
  const reset = await request.post(`${FIXTURE_API}/__test/market`, { data: {} });
  const { today } = (await reset.json()) as { today: string };
  const A = '00000000-0000-4000-8000-00000000000a';
  const B = '00000000-0000-4000-8000-00000000000b';
  const readings = [];
  for (let i = 0; i < 14; i++) {
    const d = plus(today, i);
    readings.push({ competitorId: A, stayDate: d, observedOn: today, occupancyBp: 9200, source: 'MANUAL' });
    readings.push({ competitorId: B, stayDate: d, observedOn: today, occupancyBp: 9500, source: 'MANUAL' });
  }
  await request.post(`${FIXTURE_API}/__test/market`, {
    data: {
      competitors: [
        { id: A, name: 'Отель Алтын', distanceM: 200, unitsTotal: 40 },
        { id: B, name: 'Хостел Сити', distanceM: 650 },
      ],
      readings,
    },
  });
}
