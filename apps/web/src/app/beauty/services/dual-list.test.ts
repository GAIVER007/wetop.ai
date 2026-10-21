import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../actions', () => ({
  saveBeautyService: vi.fn(),
  saveLocationService: vi.fn(),
}));
vi.mock('./materials', () => ({ ServiceMaterials: () => null }));
vi.mock('../../../components/overlay', () => ({ Overlay: () => null }));

import type { BeautyServiceRow } from '../../../lib/api';
import { ServicesBoard } from './board';

const service = (
  id: string,
  name: string,
  options: { enabled?: boolean; active?: boolean; override?: string | null; minutes?: number | null } = {},
): BeautyServiceRow => ({
  id,
  name,
  category: 'Тестовая категория',
  durationMinutes: 60,
  priceMinor: '100000',
  currency: 'KZT',
  active: options.active ?? true,
  location: options.enabled === undefined
    ? null
    : {
        enabled: options.enabled,
        priceOverrideMinor: options.override ?? null,
        durationOverrideMinutes: options.minutes ?? null,
      },
  effective: options.enabled
    ? {
        sellable: true,
        priceMinor: options.override ?? '100000',
        currency: 'KZT',
        durationMinutes: options.minutes ?? 60,
        overridden: options.override != null || options.minutes != null,
      }
    : { sellable: false, reason: options.active === false ? 'SERVICE_INACTIVE' : 'NOT_ENABLED' },
});

describe('Услуги салона и общий каталог', () => {
  it('показывает выбранные услуги слева и все активные услуги справа', () => {
    const html = renderToStaticMarkup(createElement(ServicesBoard, {
      canEdit: true,
      locationCurrency: 'KZT',
      scopeKey: 'business:location',
      items: [
        service('selected', 'Массаж выбранный', { enabled: true, override: '125050', minutes: 75 }),
        service('available', 'Массаж доступный', { enabled: false }),
        service('archived', 'Массаж архивный', { active: false, enabled: false }),
      ],
    }));

    const salonStart = html.indexOf('data-service-list="salon"');
    const catalogStart = html.indexOf('data-service-list="catalog"');
    expect(salonStart).toBeGreaterThan(-1);
    expect(catalogStart).toBeGreaterThan(salonStart);

    const salon = html.slice(salonStart, catalogStart);
    const catalog = html.slice(catalogStart);
    expect(salon).toContain('Услуги филиала');
    expect(salon).toContain('Массаж выбранный');
    expect(salon).not.toContain('Массаж доступный');
    expect(catalog).toContain('Каталог услуг');
    expect(catalog).toContain('Массаж выбранный');
    expect(catalog).toContain('Массаж доступный');
    expect(catalog).not.toContain('Массаж архивный');
    expect(html).toContain('Показать архив');
  });

  it('оставляет стрелкам доступные кнопки и передаёт точные настройки филиала', () => {
    const html = renderToStaticMarkup(createElement(ServicesBoard, {
      canEdit: true,
      locationCurrency: 'KZT',
      scopeKey: 'business:location',
      items: [
        service('selected', 'Стрижка выбранная', { enabled: true, override: '125050', minutes: 75 }),
        service('available', 'Стрижка доступная', { enabled: false }),
      ],
    }));

    expect(html).toContain('aria-label="Убрать из филиала: Стрижка выбранная"');
    expect(html).toContain('aria-label="Добавить в филиал: Стрижка доступная"');
    expect(html).toContain('aria-label="В филиале: Стрижка выбранная"');
    expect(html).toContain('name="priceOverrideMinor" value="125050"');
    expect(html).toContain('name="durationOverrideMinutes" value="75"');
    expect(html).toContain('name="scopeKey" value="business:location"');
    expect(html).toContain('draggable="true"');
  });

  it('показывает справа стартовые шаблоны до создания первой услуги без выдуманной цены', () => {
    const html = renderToStaticMarkup(createElement(ServicesBoard, {
      canEdit: true,
      locationCurrency: 'USD',
      scopeKey: 'business:location',
      items: [],
    }));

    const catalog = html.slice(html.indexOf('data-service-list="catalog"'));
    expect(catalog).toContain('Стрижка мужская');
    expect(catalog).toContain('Волосы');
    // одна строка: «Стрижка мужская, 45 мин, Волосы» (аудит 21.10.2026 п.39)
    expect(catalog).toContain('45 мин, Волосы');
    expect(catalog).not.toContain('Цена задаётся при добавлении');
    expect(catalog).toContain('aria-label="Настроить и добавить в филиал: Стрижка мужская"');
    expect(catalog).not.toContain('0 USD');
  });

  it('открывает техкарту только для сохранённой услуги и только пользователю с правом правки', () => {
    const editable = renderToStaticMarkup(createElement(ServicesBoard, {
      canEdit: true,
      locationCurrency: 'KZT',
      scopeKey: 'business:location',
      items: [service('saved-service', 'Уход сохранённый', { enabled: true })],
    }));
    const readOnly = renderToStaticMarkup(createElement(ServicesBoard, {
      canEdit: false,
      locationCurrency: 'KZT',
      scopeKey: 'business:location',
      items: [service('saved-service', 'Уход сохранённый', { enabled: true })],
    }));
    const templates = renderToStaticMarkup(createElement(ServicesBoard, {
      canEdit: true,
      locationCurrency: 'KZT',
      scopeKey: 'business:location',
      items: [],
    }));

    expect(editable).toContain('aria-label="Техкарта услуги: Уход сохранённый"');
    expect(readOnly).not.toContain('aria-label="Техкарта услуги: Уход сохранённый"');
    expect(templates).not.toContain('aria-label="Техкарта услуги: Стрижка мужская"');
  });
});

describe('аудит 21.10.2026: панель и колонки услуг', () => {
  it('п.37, п.38: без подписи над поиском, без строки-счётчика и без стрелок между колонками', () => {
    const html = renderToStaticMarkup(createElement(ServicesBoard, {
      canEdit: true, locationCurrency: 'KZT', scopeKey: 'business:location', items: [],
    }));
    expect(html).not.toContain('Добавьте первую услугу');
    expect(html).not.toContain('beauty-service-transfer-hint');
    expect(html).not.toContain('>←<');
    expect(html).toContain('aria-label="Поиск услуг"');
  });
  it('п.47: на телефоне выбор «Все услуги / В филиале», по умолчанию каталог', () => {
    const html = renderToStaticMarkup(createElement(ServicesBoard, {
      canEdit: true, locationCurrency: 'KZT', scopeKey: 'business:location', items: [],
    }));
    expect(html).toContain('data-mobile-view="catalog"');
    expect(html).toContain('Все услуги');
    expect(html).toContain('В филиале (0)');
  });
});
