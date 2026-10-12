import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { FoodWorkspace } from '../../lib/food-types';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('./reservation-drawer', () => ({ ReservationDrawer: () => null }));
vi.mock('./restaurant-actions', () => ({ setTableCleaning: vi.fn() }));
import { WorkspaceBoard } from './workspace-board';
const data: FoodWorkspace = {
  areas: [],
  tables: [],
  periods: [],
  customers: [],
  reservations: [],
  orders: [],
  date: '2026-10-12',
  time: '12:00',
  timezone: 'Asia/Almaty',
  scopeKey: 'fixture-scope',
  readOnly: false,
  canDesk: true,
  canProperty: true,
};
const render = (value: FoodWorkspace) =>
  renderToStaticMarkup(createElement(WorkspaceBoard, { data: value, floor: true }));
describe('План зала ресторана', () => {
  it('сохраняет рабочую область без залов, с доступным действием настройки', () => {
    const html = render(data);
    expect(html).toContain('data-testid="restaurant-floor-canvas"');
    expect(html).toContain('Зал ещё не настроен');
    expect(html).toContain('href="/dining-areas"');
    expect(html).not.toContain('Все бронирования назначены');
  });
  it('не предлагает правку залов без права объекта', () => {
    const html = render({ ...data, canProperty: false });
    expect(html).not.toContain('Добавить зал</a>');
  });
  it('сохраняет дату, время, переходы дня и действия брони', () => {
    const html = render(data);
    expect(html).toContain('Предыдущий день');
    expect(html).toContain('Следующий день');
    expect(html).toContain('Время плана');
    expect(html).toContain('Новая бронь');
    expect(html).toContain('Посадить без брони');
  });
  it('настроенный зал показывает реальные столы и их вместимость', () => {
    const html = render({
      ...data,
      areas: [
        {
          id: 'fixture-area',
          locationId: 'fixture-location',
          name: 'Тестовый зал',
          sortOrder: 0,
          active: true,
        },
      ],
      tables: [
        {
          id: 'fixture-table',
          areaId: 'fixture-area',
          name: '7',
          capacity: 4,
          sortOrder: 0,
          active: true,
        },
      ],
    });
    expect(html).toContain('Тестовый зал');
    expect(html).toContain('data-testid="restaurant-floor-canvas"');
    expect(html).toContain('Свободен');
    expect(html).not.toContain('Зал ещё не настроен');
  });
});

afterAll(() => {
  if (process.env.FLOOR_PREVIEW !== '1') return;
  const folder = '/private/tmp/wetop-floor-design-preview';
  mkdirSync(folder, { recursive: true });
  const css =
    ['globals', 'tokens', 'components', 'workspace', 'premium']
      .map((name) => readFileSync(`apps/web/src/app/${name}.css`, 'utf8'))
      .join('\n') +
    readFileSync('apps/web/src/app/food/food.css', 'utf8') +
    readFileSync('apps/web/src/app/food/restaurant.css', 'utf8');
  const areas = [
    {
      id: 'fixture-area',
      locationId: 'fixture-location',
      name: 'Основной зал',
      sortOrder: 0,
      active: true,
    },
  ];
  const tables = [2, 4, 4, 6, 2, 8].map((capacity, i) => ({
    id: `fixture-table-${i}`,
    areaId: 'fixture-area',
    name: String(i + 1),
    capacity,
    sortOrder: i,
    active: true,
    needsCleaning: i === 4,
  }));
  const periods = [
    {
      id: 'fixture-period',
      locationId: 'fixture-location',
      name: 'Весь день',
      weekday: 1,
      timeFrom: '09:00',
      timeTo: '22:00',
      endsNextDay: false,
      defaultDurationMinutes: 90,
      active: true,
    },
  ];
  for (const [name, value] of [
    ['empty', data],
    ['tables', { ...data, areas, tables, periods }],
  ] as const) {
    const main = render(value);
    writeFileSync(
      `${folder}/${name}.html`,
      `<!doctype html><html lang="ru" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div class="workspace"><div style="padding:12px 20px">WETOP · локальный SSR preview, вымышленные данные</div><main class="page restaurant-page"><header class="page__head"><div class="page__heading"><h1 class="page__title">План зала</h1><div class="page__subtitle">Занятость столов и бронирования ресторана</div></div></header>${main}</main></div></body></html>`,
    );
  }
});
