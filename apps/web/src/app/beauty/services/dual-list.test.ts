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
  it('оба списка разбиты подзаголовками категорий по алфавиту, «Без категории» последней (23.10.2026)', () => {
    const cat = (row: BeautyServiceRow, category: string | null) => ({ ...row, category });
    const html = renderToStaticMarkup(createElement(ServicesBoard, {
      canEdit: true,
      locationCurrency: 'KZT',
      scopeKey: 'business:location',
      items: [
        cat(service('n1', 'Маникюр', { enabled: true }), 'Ногти'),
        cat(service('h1', 'Стрижка', { enabled: false }), 'Волосы'),
        cat(service('h2', 'Окрашивание', { enabled: true }), 'Волосы'),
        cat(service('x1', 'Консультация', { enabled: false }), null),
      ],
    }));
    const catalog = html.slice(html.indexOf('data-service-list="catalog"'));
    const salon = html.slice(html.indexOf('data-service-list="salon"'), html.indexOf('data-service-list="catalog"'));
    const heads = (part: string) => [...part.matchAll(/class="beauty-service-group">([^<]+) </g)].map((m) => m[1]);
    expect(heads(salon)).toEqual(['Волосы', 'Ногти']);
    expect(heads(catalog).slice(0, 3)).toEqual(['Волосы', 'Ногти', 'Без категории']);
    expect(catalog.indexOf('Окрашивание')).toBeLessThan(catalog.indexOf('Маникюр'));
    expect(catalog.indexOf('Маникюр')).toBeLessThan(catalog.indexOf('Консультация'));
  });
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

  it('не рисует стрелок и кнопок на каждой строке: перенос только галочками и общей кнопкой', () => {
    const html = renderToStaticMarkup(createElement(ServicesBoard, {
      canEdit: true,
      locationCurrency: 'KZT',
      scopeKey: 'business:location',
      items: [
        service('selected', 'Стрижка выбранная', { enabled: true }),
        service('available', 'Стрижка доступная', { enabled: false }),
      ],
    }));
    expect(html).not.toContain('←');
    expect(html).not.toContain('→');
    expect(html).not.toContain('Добавить в филиал: Стрижка доступная');
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

  it('даёт отметить услуги галочкой и переносить пачкой, не показывая цен в списках', () => {
    const html = renderToStaticMarkup(createElement(ServicesBoard, {
      canEdit: true,
      locationCurrency: 'KZT',
      scopeKey: 'business:location',
      items: [
        service('selected', 'Массаж выбранный', { enabled: true, override: '125050' }),
        service('available', 'Массаж доступный', { enabled: false }),
        service('archived', 'Массаж архивный', { active: false, enabled: false }),
      ],
    }));
    const catalog = html.slice(html.indexOf('data-service-list="catalog"'));

    expect(html).toContain('aria-label="Выбрать все услуги филиала"');
    expect(html).toContain('aria-label="Выбрать все услуги каталога"');
    expect(html).toContain('aria-label="Выбрать: Массаж доступный"');
    // уже стоящая в филиале услуга справа не отмечается: переносить нечего
    expect(catalog).toMatch(/aria-label="Выбрать: Массаж выбранный"[^>]*disabled/);
    // типовые услуги тоже можно отметить
    expect(catalog).toContain('aria-label="Выбрать: Стрижка мужская"');
    // цен нет: их правят вручную в карточке
    expect(html).not.toMatch(/1\s?000/);
    expect(html).not.toContain('₸');
  });

  it('просит указать цену у услуги филиала, добавленной пачкой с нулевой ценой', () => {
    const zero = { ...service('zero', 'Типовая без цены', { enabled: true }), priceMinor: '0' };
    zero.effective = { sellable: true, priceMinor: '0', currency: 'KZT', durationMinutes: 60, overridden: false };
    const html = renderToStaticMarkup(createElement(ServicesBoard, {
      canEdit: true,
      locationCurrency: 'KZT',
      scopeKey: 'business:location',
      items: [zero],
    }));
    const salon = html.slice(html.indexOf('data-service-list="salon"'), html.indexOf('data-service-list="catalog"'));
    expect(salon).toContain('Укажите цену');
  });

  it('без права правки не показывает галочки и массовые кнопки', () => {
    const html = renderToStaticMarkup(createElement(ServicesBoard, {
      canEdit: false,
      locationCurrency: 'KZT',
      scopeKey: 'business:location',
      items: [service('s', 'Только чтение', { enabled: true })],
    }));
    expect(html).not.toContain('Выбрать все');
    expect(html).not.toContain('type="checkbox" class="beauty-service-check"');
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
