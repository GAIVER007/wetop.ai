import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../actions', () => ({
  saveBeautyService: vi.fn(),
  saveLocationService: vi.fn(),
  moveLocationServices: vi.fn(),
}));
vi.mock('./materials', () => ({ ServiceMaterials: () => null }));
vi.mock('../../../components/overlay', () => ({ Overlay: () => null }));

import type { BeautyServiceRow } from '../../../lib/api';
import { ServicesBoard } from './board';
import { categoryTone, servicesSummary } from './price-list';

const service = (
  id: string,
  name: string,
  options: { enabled?: boolean; active?: boolean; override?: string | null; minutes?: number | null; category?: string | null; price?: string; visits?: number } = {},
): BeautyServiceRow => ({
  id,
  name,
  category: options.category === undefined ? 'Тестовая категория' : options.category,
  durationMinutes: 60,
  priceMinor: options.price ?? '100000',
  currency: 'KZT',
  active: options.active ?? true,
  ...(options.visits !== undefined ? { popularity: { completedVisits: options.visits, totalCompletedVisits: 10 } } : {}),
  location: options.enabled === undefined
    ? null
    : { enabled: options.enabled, priceOverrideMinor: options.override ?? null, durationOverrideMinutes: options.minutes ?? null },
  effective: options.enabled
    ? {
        sellable: true,
        priceMinor: options.override ?? options.price ?? '100000',
        currency: 'KZT',
        durationMinutes: options.minutes ?? 60,
        overridden: options.override != null || options.minutes != null,
      }
    : { sellable: false, reason: options.active === false ? 'SERVICE_INACTIVE' : 'NOT_ENABLED' },
});

const board = (items: BeautyServiceRow[], canEdit = true) =>
  renderToStaticMarkup(createElement(ServicesBoard, { canEdit, locationCurrency: 'KZT', scopeKey: 'business:location', items }));

describe('Услуги салона: группа без категории на языке интерфейса', () => {
  it('на английском экране заголовок «Uncategorized», а не русская строка', async () => {
    const { LocaleProvider } = await import('../../../i18n/locale-provider');
    const html = renderToStaticMarkup(
      createElement(LocaleProvider, {
        locale: 'en',
        children: createElement(ServicesBoard, {
          canEdit: true,
          locationCurrency: 'KZT',
          scopeKey: 'business:location',
          items: [service('x1', 'Manicure', { enabled: true, category: null })],
        }),
      }),
    );
    const heads = [...html.matchAll(/class="beauty-service-group">([^<]+) </g)].map((m) => m[1]);
    expect(heads).toContain('Uncategorized');
    expect(heads).not.toContain('Без категории');
  });
});

/**
 * Владелец 30.10.2026: «Услуги вот так норм, делай» (макет): две колонки как раньше. Слева «В филиале», справа
 * «Можно добавить», посередине стрелки ← и →; строка в одну линию: галочка, название, минуты, цена, доля визитов.
 */
describe('Услуги салона: две колонки со стрелками (30.10.2026)', () => {
  const html = () =>
    board([
      service('h1', 'Окрашивание', { enabled: true, category: 'Волосы', override: '2500000', minutes: 120, visits: 3 }),
      service('h2', 'Стрижка', { enabled: true, category: 'Волосы', price: '800000' }),
      service('n1', 'Маникюр', { enabled: false, category: 'Ногти', price: '900000' }),
    ]);
  const column = (markup: string, name: 'location' | 'catalog') =>
    markup.match(new RegExp(`<section[^>]*data-service-column="${name}"[\\s\\S]*?</section>`))?.[0] ?? '';

  it('слева услуги филиала по категориям, справа то, чего в филиале нет, включая типовые', () => {
    const m = html();
    const left = column(m, 'location');
    const right = column(m, 'catalog');
    expect(left).toContain('В филиале');
    expect(left).toContain('Окрашивание');
    expect(left).toContain('Стрижка');
    expect(left).not.toContain('Маникюр');
    expect(right).toContain('Можно добавить');
    expect(right).toContain('Маникюр');
    expect(right).not.toContain('aria-label="Выбрать: Окрашивание"');
    expect(right).toContain('Стрижка мужская'); // типовая
  });

  it('строка в одну линию: цена филиала, минуты и доля визитов', () => {
    const left = column(html(), 'location');
    expect(left).toContain('25 000 ₸');
    expect(left).toContain('120 мин');
    expect(left).toContain('30 %');
  });

  it('посередине две стрелки: ← добавить отмеченные справа, → убрать отмеченные слева', () => {
    const m = html();
    expect(m).toMatch(/aria-label="Добавить в филиал отмеченные"[^>]*>←/);
    expect(m).toMatch(/aria-label="Убрать из филиала отмеченные"[^>]*>→/);
    expect(m).toContain('aria-label="Выбрать: Маникюр"');
    expect(m).toContain('aria-label="Выбрать: Окрашивание"');
  });

  it('у каждой услуги филиала правка и техкарта, без выключателя: колонка и есть «в филиале»', () => {
    const left = column(html(), 'location');
    expect(left).toContain('aria-label="Изменить: Окрашивание"');
    expect(left).toContain('aria-label="Техкарта услуги: Окрашивание"');
    expect(html()).not.toContain('role="switch"');
  });

  it('без права правки: нет галочек, стрелок и кнопок', () => {
    const ro = board([service('s', 'Уход', { enabled: true }), service('x', 'Пилинг', { enabled: false })], false);
    expect(ro).not.toContain('Выбрать:');
    expect(ro).not.toContain('Добавить в филиал отмеченные');
    expect(ro).not.toContain('Техкарта услуги');
    expect(ro).not.toContain('Изменить:');
  });

  it('услуга филиала без цены просит её указать, архив скрыт', () => {
    const m = board([service('z', 'Без цены', { enabled: true, price: '0' }), service('arch', 'Старая', { active: false, enabled: false })]);
    expect(m).toContain('Укажите цену');
    expect(m).not.toContain('0 ₸');
    expect(m).not.toContain('Старая');
  });

  it('итоги одной строкой: в филиале из всех, средняя цена филиала, частая услуга, без цены', () => {
    const rows = [
      service('a', 'Стрижка', { enabled: true, price: '800000', visits: 5 }),
      service('b', 'Окрашивание', { enabled: true, price: '2500000', visits: 2 }),
      service('c', 'Укладка', { enabled: true, price: '0' }),
      service('d', 'Педикюр', { enabled: false, price: '1100000' }),
      service('e', 'Архив', { active: false, enabled: false }),
    ];
    expect(servicesSummary(rows)).toEqual({
      inLocation: 3,
      total: 4,
      averageMinor: '1650000',
      top: 'Стрижка',
      missingPrice: 1,
    });
    const markup = board(rows);
    expect(markup).toContain('В филиале');
    expect(markup).toContain('16 500 ₸');
  });

  it('цвет категории постоянный и не зависит от регистра; без категории — нейтральный', () => {
    expect(categoryTone('Волосы')).toBe(categoryTone(' волосы '));
    expect(categoryTone(null)).toBe(0);
    expect(categoryTone('Ногти')).toBeGreaterThan(0);
  });
});
