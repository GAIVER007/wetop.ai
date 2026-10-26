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

describe('Услуги салона: прайс-лист (вариант B, 25.10.2026)', () => {
  it('одна таблица по категориям: цена филиала, длительность и доля визитов в строке', () => {
    const html = board([
      service('h1', 'Окрашивание', { enabled: true, category: 'Волосы', override: '2500000', minutes: 120, visits: 3 }),
      service('n1', 'Маникюр', { enabled: false, category: 'Ногти', price: '900000' }),
    ]);
    expect(html).toContain('data-service-list="price"');
    expect(html).not.toContain('data-service-list="catalog"');
    expect(html).toContain('25 000 ₸');
    expect(html).toContain('9 000 ₸');
    expect(html).toContain('120 мин');
    expect(html).toContain('30% визитов');
    const heads = [...html.matchAll(/class="beauty-service-group">([^<]+) </g)].map((m) => m[1]);
    expect(heads.slice(0, 2)).toEqual(['Волосы', 'Ногти']);
  });

  it('«В филиале» — выключатель в строке, архивную услугу включить нельзя', () => {
    const html = board([
      service('on', 'Стрижка', { enabled: true }),
      service('off', 'Укладка', { enabled: false }),
      service('arch', 'Старая', { active: false, enabled: false }),
    ]);
    expect(html).toMatch(/role="switch" aria-label="В филиале: Стрижка"[^>]*checked/);
    expect(html).not.toMatch(/role="switch" aria-label="В филиале: Укладка"[^>]*checked=""/);
    // архив скрыт по умолчанию
    expect(html).not.toContain('Старая');
  });

  it('пачкой: общая галочка и две кнопки «Добавить в филиал» и «Убрать из филиала»', () => {
    const html = board([service('a', 'Пачка один', { enabled: false }), service('b', 'Пачка два', { enabled: true })]);
    expect(html).toContain('aria-label="Выбрать все услуги"');
    expect(html).toContain('aria-label="Выбрать: Пачка один"');
    expect(html).toContain('Добавить в филиал');
    expect(html).toContain('Убрать из филиала');
    expect(html).not.toContain('←');
  });

  it('услуга филиала без цены просит её указать, типовые услуги добавляются с выбором цены', () => {
    const html = board([service('z', 'Типовая без цены', { enabled: true, price: '0' })]);
    expect(html).toContain('Укажите цену');
    expect(html).toContain('aria-label="Настроить и добавить в филиал: Стрижка мужская"');
    expect(html).not.toContain('0 ₸');
  });

  it('техкарта и правка только с правом правки; без права нет галочек и кнопок', () => {
    const editable = board([service('s', 'Уход', { enabled: true })]);
    const readOnly = board([service('s', 'Уход', { enabled: true })], false);
    expect(editable).toContain('aria-label="Техкарта услуги: Уход"');
    expect(readOnly).not.toContain('Техкарта услуги');
    expect(readOnly).not.toContain('Выбрать все услуги');
    expect(readOnly).not.toContain('Изменить');
    expect(readOnly).toMatch(/role="switch" aria-label="В филиале: Уход"[^>]*disabled/);
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
    const html = board(rows);
    expect(html).toContain('В филиале');
    expect(html).toContain('16 500 ₸');
  });

  it('цвет категории постоянный и не зависит от регистра; без категории — нейтральный', () => {
    expect(categoryTone('Волосы')).toBe(categoryTone(' волосы '));
    expect(categoryTone(null)).toBe(0);
    expect(categoryTone('Ногти')).toBeGreaterThan(0);
  });
});
