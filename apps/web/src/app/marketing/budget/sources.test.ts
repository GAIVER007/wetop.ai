import { describe, expect, it } from 'vitest';
import type { MarketingResultsView, MetaConnectionView } from '../../../lib/api';
import { dataSources } from './sources';

/**
 * «Откуда берутся цифры» на сводке «Бюджета и аналитики» (поручение владельца 20.10.2026: «чётко, как добавлять
 * источники расходов и т. д.»): по каждому источнику состояние словами и что сделать, чтобы он заработал.
 */
const results = (over: Partial<MarketingResultsView> = {}): MarketingResultsView => ({
  month: '2026-10',
  reportingCurrency: 'KZT',
  revenueCurrency: 'KZT',
  supported: true,
  channels: [{ channel: 'SITE', leads: 4, bookings: 2, revenue: '100000' }],
  days: [],
  ...over,
});
const meta = (connection: MetaConnectionView['connection'], configured = true): MetaConnectionView => ({
  configured,
  connection,
});
const active = {
  adAccountId: '1234567890',
  accountName: 'Отель на Абая',
  currency: 'USD',
  timezone: 'Asia/Almaty',
  status: 'ACTIVE' as const,
  lastSyncedAt: '2026-10-20T03:00:00Z',
  lastError: null,
};
const base = { expenses: 3, otherAds: [] as string[], meta: meta(active), results: results(), editable: true };
const by = (list: ReturnType<typeof dataSources>, key: string) => list.find((s) => s.key === key)!;

describe('dataSources: порядок и состав', () => {
  it('три источника всегда: расходы вручную, кабинет Meta, заявки и выручка', () => {
    expect(dataSources(base).map((s) => s.key)).toEqual(['manual', 'meta', 'results']);
  });

  it('реклама без кабинетов в журнале (Google, TikTok): четвёртая строка, что она только вручную', () => {
    const list = dataSources({ ...base, otherAds: ['GOOGLE', 'TIKTOK'] });
    expect(list.map((s) => s.key)).toEqual(['manual', 'meta', 'results', 'other-ads']);
    const other = by(list, 'other-ads');
    expect(other.state).toBe('manual');
    expect(other.text).toContain('Google Ads, TikTok Ads');
  });
});

describe('dataSources: расходы вручную', () => {
  it('есть строки: подключено, число строк словами, действия добавить и загрузить', () => {
    const s = by(dataSources(base), 'manual');
    expect(s.state).toBe('ok');
    expect(s.status).toBe('3 расхода за месяц');
    expect(s.actions).toEqual(['add-expense', 'import-csv', 'journal']);
  });

  it('пусто: «нужно добавить» и подсказка с первого шага', () => {
    const s = by(dataSources({ ...base, expenses: 0 }), 'manual');
    expect(s.state).toBe('todo');
    expect(s.status).toBe('Расходов за месяц нет');
    expect(s.text).toMatch(/Добавить расход|CSV/);
  });

  it('без права правки: только журнал, кнопок добавления нет', () => {
    expect(by(dataSources({ ...base, editable: false }), 'manual').actions).toEqual(['journal']);
  });
});

describe('dataSources: кабинет Meta', () => {
  it('подключён: имя, валюта, время обновления; ведёт в «Рекламу»', () => {
    const s = by(dataSources(base), 'meta');
    expect(s.state).toBe('ok');
    expect(s.status).toBe('Подключён: Отель на Абая, USD');
    expect(s.text).toContain('каждую ночь');
    expect(s.actions).toEqual(['open-ads']);
  });

  it('не подключён: «нужно подключить», кнопка входа через Facebook прямо здесь', () => {
    const s = by(dataSources({ ...base, meta: meta(null) }), 'meta');
    expect(s.state).toBe('todo');
    expect(s.status).toBe('Не подключён');
    expect(s.actions).toEqual(['connect-meta']);
  });

  it('сверка упала: предупреждение с ошибкой словами и повторное подключение', () => {
    const s = by(
      dataSources({ ...base, meta: meta({ ...active, status: 'FAILED', lastError: 'Ключ доступа истёк' }) }),
      'meta',
    );
    expect(s.state).toBe('error');
    expect(s.status).toBe('Нужно подключить заново');
    expect(s.text).toContain('Ключ доступа истёк');
    expect(s.actions).toEqual(['connect-meta']);
  });

  it('приложение Meta на платформе не настроено: честно «пока недоступно», без кнопки', () => {
    const s = by(dataSources({ ...base, meta: meta(null, false) }), 'meta');
    expect(s.state).toBe('off');
    expect(s.actions).toEqual([]);
  });

  it('состояние кабинета не загрузилось: ошибка словами, ссылка в «Рекламу»', () => {
    const s = by(dataSources({ ...base, meta: 'error' }), 'meta');
    expect(s.state).toBe('error');
    expect(s.status).toBe('Не удалось узнать');
    expect(s.actions).toEqual(['open-ads']);
  });

  it('без права правки кнопки подключения нет', () => {
    expect(by(dataSources({ ...base, meta: meta(null), editable: false }), 'meta').actions).toEqual([]);
  });
});

describe('dataSources: заявки и выручка', () => {
  it('гостиница: сами из броней и заявок, добавлять ничего не нужно', () => {
    const s = by(dataSources(base), 'results');
    expect(s.state).toBe('ok');
    expect(s.status).toBe('Подтягиваются сами');
    expect(s.text).toMatch(/сайт.*WhatsApp.*Instagram.*телефон/);
    expect(s.actions).toEqual(['open-analytics']);
  });

  it('салон и ресторан: пока недоступно, причина словами', () => {
    const s = by(
      dataSources({ ...base, results: results({ supported: false, revenueCurrency: null, channels: [] }) }),
      'results',
    );
    expect(s.state).toBe('off');
    expect(s.status).toBe('Пока недоступно');
  });

  it('не загрузились: ошибка', () => {
    expect(by(dataSources({ ...base, results: 'error' }), 'results').state).toBe('error');
  });
});
