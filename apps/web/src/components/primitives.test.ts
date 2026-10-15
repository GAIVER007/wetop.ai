import { createElement as h, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Chip, ChipGroup } from './chip';
import { Segmented, segmentAfterKey } from './segmented';
import { Tabs, rovingIndex } from './tabs';
import { Toolbar } from './toolbar';

/*
 * MV8.5 DS1b: договор четырёх примитивов (DESIGN.md §8.1). Разметка снимается серверным рендером,
 * клавиатура проверяется чистыми функциями, которыми пользуются компоненты; живые стрелки и фокус в
 * браузере держит `tests/ui/ds1b-primitives.spec.ts`.
 */
const html = (el: ReactElement) => renderToStaticMarkup(el);
const doc = (el: ReactElement) => {
  // без DOM: разбираем атрибуты регулярками по открывающим тегам
  const markup = html(el);
  const tags = [...markup.matchAll(/<([a-z]+)([^>]*)>/g)].map((m) => ({
    tag: m[1]!,
    attrs: Object.fromEntries(
      [...m[2]!.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map((a) => [a[1]!, a[2] ?? '']),
    ) as Record<string, string>,
  }));
  return { markup, tags };
};

describe('Tabs маршрутами', () => {
  const view = doc(
    h(Tabs, {
      label: 'Настройки объекта',
      items: [
        { href: '/a', label: 'Объект', current: false },
        { href: '/b', label: 'Проживание', current: true, count: 3 },
      ],
    }),
  );
  it('nav со ссылками, текущая с aria-current="page"', () => {
    const nav = view.tags.find((t) => t.tag === 'nav');
    expect(nav?.attrs['aria-label']).toBe('Настройки объекта');
    const links = view.tags.filter((t) => t.tag === 'a');
    expect(links.map((l) => l.attrs['href'])).toEqual(['/a', '/b']);
    expect(links.map((l) => l.attrs['aria-current'])).toEqual([undefined, 'page']);
  });
  it('ссылки не превращены в ARIA-вкладки', () => {
    expect(view.markup).not.toMatch(/role="tab/);
    expect(view.markup).not.toMatch(/aria-selected/);
  });
  it('счётчик внутри подписи', () =>
    expect(view.markup).toMatch(/Проживание.*tabs__count[^>]*>3</));
});

describe('Tabs на странице', () => {
  const view = doc(
    h(Tabs, {
      label: 'Разделы карточки',
      panels: [
        { id: 'overview', label: 'Обзор', content: 'обзор' },
        { id: 'folio', label: 'Счета', content: 'счета', count: 2 },
        { id: 'actions', label: 'Действия', content: 'действия' },
      ],
    }),
  );
  const tabs = view.tags.filter((t) => t.attrs['role'] === 'tab');
  const panels = view.tags.filter((t) => t.attrs['role'] === 'tabpanel');
  it('tablist с именем, три вкладки и три панели', () => {
    expect(view.tags.find((t) => t.attrs['role'] === 'tablist')?.attrs['aria-label']).toBe(
      'Разделы карточки',
    );
    expect(tabs).toHaveLength(3);
    expect(panels).toHaveLength(3);
  });
  it('выбрана первая, только она в порядке Tab', () => {
    expect(tabs.map((t) => t.attrs['aria-selected'])).toEqual(['true', 'false', 'false']);
    expect(tabs.map((t) => t.attrs['tabindex'])).toEqual(['0', '-1', '-1']);
  });
  it('вкладка и панель ссылаются друг на друга', () => {
    tabs.forEach((tab, i) => {
      expect(tab.attrs['aria-controls']).toBe(panels[i]!.attrs['id']);
      expect(panels[i]!.attrs['aria-labelledby']).toBe(tab.attrs['id']);
    });
  });
  it('скрыты все панели, кроме выбранной', () =>
    expect(panels.map((p) => 'hidden' in p.attrs)).toEqual([false, true, true]));
});

describe('клавиатура вкладок и переключателя', () => {
  it('стрелки по кругу, Home и End, прочие клавиши не трогаем', () => {
    expect(rovingIndex('ArrowRight', 0, 3)).toBe(1);
    expect(rovingIndex('ArrowRight', 2, 3)).toBe(0);
    expect(rovingIndex('ArrowLeft', 0, 3)).toBe(2);
    expect(rovingIndex('Home', 2, 3)).toBe(0);
    expect(rovingIndex('End', 0, 3)).toBe(2);
    expect(rovingIndex('Enter', 1, 3)).toBe(-1);
    expect(rovingIndex('ArrowDown', 1, 3)).toBe(-1);
  });
  it('переключатель выбирает соседнее значение', () => {
    const options = [
      { value: 'compact', label: 'Компактный' },
      { value: 'normal', label: 'Обычный' },
      { value: 'detailed', label: 'Подробный' },
    ];
    expect(segmentAfterKey(options, 'compact', 'ArrowRight')).toBe('normal');
    expect(segmentAfterKey(options, 'compact', 'ArrowLeft')).toBe('detailed');
    expect(segmentAfterKey(options, 'normal', 'End')).toBe('detailed');
    expect(segmentAfterKey(options, 'detailed', 'Home')).toBe('compact');
    expect(segmentAfterKey(options, 'normal', 'Tab')).toBeNull();
  });
});

describe('Chip', () => {
  it('кнопка с aria-pressed и спокойным выбранным видом', () => {
    const on = doc(h(Chip, { selected: true, children: 'Заезды' })).tags[0]!;
    const off = doc(h(Chip, { selected: false, children: 'Заезды' })).tags[0]!;
    expect(on.tag).toBe('button');
    expect(on.attrs['type']).toBe('button');
    expect(on.attrs['aria-pressed']).toBe('true');
    expect(off.attrs['aria-pressed']).toBe('false');
    expect(on.attrs['class']).not.toMatch(/btn/);
  });
  it('число читается в подписи', () =>
    expect(html(h(Chip, { selected: false, count: 3, children: 'Заезды' }))).toMatch(
      /Заезды<span class="chip__count">3<\/span>/,
    ));
  it('отключённый и маленький', () => {
    const chip = doc(h(Chip, { selected: false, disabled: true, size: 'sm', children: 'Койки' }))
      .tags[0]!;
    expect('disabled' in chip.attrs).toBe(true);
    expect(chip.attrs['class']).toMatch(/\bchip--sm\b/);
  });
  it('ссылка, когда отбор живёт в адресе: выбранная с aria-current', () => {
    const chip = doc(
      h(Chip, { selected: true, href: '/reservations?view=future', children: 'Будущие' }),
    ).tags[0]!;
    expect(chip.tag).toBe('a');
    expect(chip.attrs['aria-current']).toBe('page');
    expect(chip.attrs['aria-pressed']).toBeUndefined();
  });
});

describe('ChipGroup', () => {
  it('группа кнопок с именем', () => {
    const group = doc(
      h(ChipGroup, { label: 'Тип места', children: h(Chip, { selected: false, children: 'Все' }) }),
    ).tags[0]!;
    expect(group.tag).toBe('div');
    expect(group.attrs['role']).toBe('group');
    expect(group.attrs['aria-label']).toBe('Тип места');
  });
  it('ряд ссылок: навигация с именем', () => {
    const group = doc(h(ChipGroup, { as: 'nav', labelledBy: 'views-title', children: 'x' }))
      .tags[0]!;
    expect(group.tag).toBe('nav');
    expect(group.attrs['aria-labelledby']).toBe('views-title');
    expect(group.attrs['role']).toBeUndefined();
  });
});

describe('Segmented', () => {
  const view = doc(
    h(Segmented, {
      label: 'Вид строк календаря',
      value: 'normal',
      onChange: () => undefined,
      options: [
        { value: 'compact', label: 'Компактный' },
        { value: 'normal', label: 'Обычный' },
        { value: 'detailed', label: 'Подробный' },
      ],
    }),
  );
  const buttons = view.tags.filter((t) => t.tag === 'button');
  it('группа с именем, выбран ровно один', () => {
    expect(view.tags[0]!.attrs['role']).toBe('group');
    expect(view.tags[0]!.attrs['aria-label']).toBe('Вид строк календаря');
    expect(buttons.map((b) => b.attrs['aria-pressed'])).toEqual(['false', 'true', 'false']);
  });
  it('Tab попадает только на выбранный', () =>
    expect(buttons.map((b) => b.attrs['tabindex'])).toEqual(['-1', '0', '-1']));
});

describe('Toolbar', () => {
  it('группа с именем, слоты в порядке поиск, отбор, период, действия', () => {
    // слоты переданы вперемешку: порядок в разметке от этого не зависит
    const markup = html(
      h(Toolbar, {
        label: 'Поиск и отбор',
        actions: h('button', null, 'Показать'),
        period: h('span', null, 'Даты'),
        filters: h('span', null, 'Статус'),
        search: h('input', { 'aria-label': 'Поиск' }),
      }),
    );
    expect(markup).toMatch(/^<div[^>]*role="group"[^>]*aria-label="Поиск и отбор"/);
    const order = [...markup.matchAll(/toolbar__(\w+)/g)].map((m) => m[1]);
    expect(order).toEqual(['search', 'filters', 'period', 'actions']);
  });
  it('пустой слот не рисуется', () => {
    const markup = html(h(Toolbar, { label: 'Отбор', search: h('input'), actions: 'x' }));
    expect(markup).not.toMatch(/toolbar__filters|toolbar__period/);
  });
});
