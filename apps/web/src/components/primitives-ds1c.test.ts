import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement as h, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DateBar } from './date-bar';
import { ErrorState } from './error-state';
import { FormGrid } from './form-grid';
import { Overlay } from './overlay';
import { PeriodPicker } from './period-picker';
import { RouteDrawer } from './route-drawer';
import { ShareBar } from './share-bar';
import { EmptyState, Field, Input, Stat, Table } from './ui';

/*
 * MV8.5 DS1c: договор остальных примитивов (DESIGN.md §8.2). Разметка снимается серверным рендером;
 * клавиатуру, Escape, фокус и телефон держит `tests/ui/ds1c-primitives.spec.ts`.
 */
const html = (el: ReactElement) => renderToStaticMarkup(el);
const tags = (el: ReactElement) =>
  [...html(el).matchAll(/<([a-z0-9]+)([^>]*)>/g)].map((m) => ({
    tag: m[1]!,
    attrs: Object.fromEntries(
      [...m[2]!.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map((a) => [a[1]!, a[2] ?? '']),
    ) as Record<string, string>,
  }));
const noop = () => undefined;

describe('Stat', () => {
  it('изменение словами со знаком и стрелкой-глифом, без цвета направления', () => {
    const markup = html(
      h(Stat, { label: 'Загрузка', value: '72 %', delta: { direction: 'up', text: '+3,2 п.п.' } }),
    );
    expect(markup).toMatch(/class="stat__delta"[^>]*data-direction="up"/);
    expect(markup).toContain('+3,2 п.п.');
    expect(markup).toMatch(/aria-hidden="true">↑</);
  });
  it('нет базы для сравнения: текст без стрелки', () => {
    const markup = html(
      h(Stat, {
        label: 'Выручка',
        value: '0 ₸',
        delta: { direction: null, text: 'нет базы для сравнения' },
      }),
    );
    expect(markup).toContain('нет базы для сравнения');
    expect(markup).not.toMatch(/[↑↓→]/);
  });
  it('тон и размер по общей шкале', () => {
    const div = tags(h(Stat, { label: 'Долг', value: '5 ₸', tone: 'danger', size: 'lg' }))[0]!;
    expect(div.attrs['class']).toBe('stat stat--tone-danger stat--lg');
    const plain = tags(h(Stat, { label: 'Свободно', value: '3' }))[0]!;
    expect(plain.attrs['class']).toBe('stat');
  });
  it('прежние alarm, warn, big, compact остаются и выглядят как раньше', () => {
    const div = tags(h(Stat, { label: 'Долг', value: '5 ₸', tone: 'alarm', size: 'big' }))[0]!;
    expect(div.attrs['class']).toBe('stat stat--alarm stat--big');
  });
  it('с href вся плитка одна ссылка, внутри других ссылок и кнопок нет', () => {
    const list = tags(h(Stat, { label: 'Заезды', value: '4', href: '/reservations?view=today' }));
    expect(list[0]!.tag).toBe('a');
    expect(list[0]!.attrs['href']).toBe('/reservations?view=today');
    expect(list[0]!.attrs['class']).toMatch(/\bstat--link\b/);
    expect(list.slice(1).some((t) => t.tag === 'a' || t.tag === 'button')).toBe(false);
  });
});

describe('ShareBar', () => {
  it('родной progress с именем, значением и пределом, число рядом', () => {
    const markup = html(h(ShareBar, { label: 'Доля Kaspi', value: 37, max: 100, showValue: true }));
    const progress = tags(h(ShareBar, { label: 'Доля Kaspi', value: 37, max: 100 })).find(
      (t) => t.tag === 'progress',
    )!;
    expect(progress.attrs).toMatchObject({ value: '37', max: '100', 'aria-label': 'Доля Kaspi' });
    expect(markup).toMatch(/share-bar__value[^>]*>37 %</);
  });
  it('0 и 100 без выхода за предел, без строки style', () => {
    for (const value of [0, 100, 140, -5]) {
      const markup = html(h(ShareBar, { label: 'Доля', value, max: 100, showValue: true }));
      expect(markup).not.toContain('style=');
      const shown = Math.min(100, Math.max(0, value));
      expect(markup).toContain(`value="${shown}"`);
    }
  });
  it('середина: 50 из 100 и число словами', () => {
    expect(html(h(ShareBar, { label: 'Доля', value: 50, showValue: true }))).toMatch(
      /value="50"[\s\S]*>50 %</,
    );
  });
  it('тон классом по общей шкале, нейтральный без класса', () => {
    expect(tags(h(ShareBar, { label: 'Доля', value: 5 }))[0]!.attrs['class']).toBe('share-bar');
    for (const tone of ['info', 'success', 'warning', 'danger'] as const) {
      const cls = tags(h(ShareBar, { label: 'Доля', value: 5, tone }))[0]!.attrs['class'];
      expect(cls).toBe(`share-bar share-bar--tone-${tone}`);
    }
  });
});

describe('FormGrid', () => {
  it('колонки одним классом, без ширин в пикселях', () => {
    const div = tags(h(FormGrid, { columns: 2, children: 'x' }))[0]!;
    expect(div.attrs['class']).toBe('form-grid form-grid--2');
    expect(html(h(FormGrid, { columns: 3, children: 'x' }))).not.toContain('style=');
    expect(tags(h(FormGrid, { children: 'x' }))[0]!.attrs['class']).toBe('form-grid form-grid--2');
  });
  it('плотность: compact классом, normal по умолчанию без класса', () => {
    expect(tags(h(FormGrid, { density: 'compact', children: 'x' }))[0]!.attrs['class']).toBe(
      'form-grid form-grid--2 form-grid--compact',
    );
    expect(tags(h(FormGrid, { density: 'normal', children: 'x' }))[0]!.attrs['class']).toBe(
      'form-grid form-grid--2',
    );
  });
  it('на телефоне одна колонка, дети сжимаются', () => {
    const css = readFileSync(resolve(import.meta.dirname, '../app/components.css'), 'utf8');
    expect(css).toMatch(/\.form-grid > \* \{\s*min-width: 0;/);
    expect(css).toMatch(
      /@media \(max-width: 600px\) \{\s*\.form-grid--2,\s*\.form-grid--3 \{\s*grid-template-columns: minmax\(0, 1fr\);/,
    );
  });
});

describe('DateBar', () => {
  const view = (withToday: boolean) =>
    tags(
      h(DateBar, {
        date: '2026-10-12',
        onDateChange: noop,
        onPrevious: noop,
        onNext: noop,
        ...(withToday ? { onToday: noop } : {}),
      }),
    );
  it('кнопки с именами, поле «Дата» с видимой подписью и значением', () => {
    const list = view(true);
    const names = list.filter((t) => t.tag === 'button').map((t) => t.attrs['aria-label'] ?? '');
    expect(names).toEqual(['', 'Предыдущий день', 'Следующий день']);
    expect(html(h(DateBar, { date: '2026-10-12', onDateChange: noop, onPrevious: noop, onNext: noop, onToday: noop }))).toMatch(/>Сегодня</);
    const input = list.find((t) => t.tag === 'input')!;
    expect(input.attrs).toMatchObject({ type: 'date', value: '2026-10-12' });
    expect(html(h(DateBar, { date: '2026-10-12', onDateChange: noop, onPrevious: noop, onNext: noop }))).toMatch(/<label[^>]*class="field"[^>]*>Дата</);
  });
  it('без onToday кнопки «Сегодня» нет', () => {
    expect(view(false).filter((t) => t.tag === 'button')).toHaveLength(2);
  });
  it('значок назад из набора, без поворота стилем', () => {
    const markup = html(
      h(DateBar, { date: '2026-10-12', onDateChange: noop, onPrevious: noop, onNext: noop }),
    );
    expect(markup).not.toContain('rotate');
    expect(markup).not.toContain('style=');
  });
});

describe('PeriodPicker', () => {
  it('поля «С» и «По» с именами формы и отрезок готовыми ссылками', () => {
    const markup = html(
      h(PeriodPicker, {
        from: '2026-09-10',
        to: '2026-09-24',
        fromName: 'from',
        toName: 'to',
        presets: [
          { label: 'Сегодня', href: '/r?from=a&to=a', selected: false },
          { label: '7 дней', href: '/r?from=a&to=b', selected: true },
        ],
      }),
    );
    expect(markup).toMatch(/name="from"[^>]*value="2026-09-10"|value="2026-09-10"[^>]*name="from"/);
    expect(markup).toMatch(/aria-label="Период: с"/);
    expect(markup).toMatch(/aria-label="Период: по"/);
    expect(markup).toMatch(/<nav[^>]*aria-label="Готовые периоды"/);
    expect(markup).toMatch(/aria-current="page"[^>]*>7 дней</);
  });
  it('ошибка словами у отрезка, без кнопки применения: применяет экран', () => {
    const markup = html(
      h(PeriodPicker, {
        from: '2026-09-24',
        to: '2026-09-10',
        fromName: 'from',
        toName: 'to',
        error: 'Дата «по» раньше даты «с»',
      }),
    );
    expect(markup).toMatch(/role="alert"[^>]*>Дата «по» раньше даты «с»</);
    expect(markup).not.toContain('<button type="submit"');
  });
  it('ошибки по полям: у поля «С» и у поля «По» своё слово и aria-invalid', () => {
    const markup = html(
      h(PeriodPicker, {
        from: '',
        to: '2026-09-10',
        fromName: 'from',
        toName: 'to',
        errors: { from: 'Укажите дату «с»', to: 'Дата «по» раньше даты «с»' },
      }),
    );
    expect(markup).toMatch(/aria-invalid="true"[^>]*aria-label="Период: с"|aria-label="Период: с"[^>]*aria-invalid="true"/);
    expect(markup).toContain('Укажите дату «с»');
    expect(markup).toContain('Дата «по» раньше даты «с»');
  });
  it('управляемый ввод: onFromChange и onToChange получают дату, применяет экран', () => {
    const got: string[] = [];
    const tree = PeriodPicker({
      from: '2026-09-10',
      to: '2026-09-24',
      fromName: 'from',
      toName: 'to',
      onFromChange: (v) => got.push(`from:${v}`),
      onToChange: (v) => got.push(`to:${v}`),
    });
    const inputs: Array<{ onChange?: (e: { target: { value: string } }) => void }> = [];
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!node || typeof node !== 'object' || !('props' in node)) return;
      const props = (node as { props: Record<string, unknown> }).props;
      if (typeof props['aria-label'] === 'string' && String(props['aria-label']).startsWith('Период'))
        inputs.push(props as never);
      walk(props['children']);
    };
    walk(tree);
    expect(inputs).toHaveLength(2);
    inputs[0]!.onChange!({ target: { value: '2026-09-11' } });
    inputs[1]!.onChange!({ target: { value: '2026-09-25' } });
    expect(got).toEqual(['from:2026-09-11', 'to:2026-09-25']);
  });
});

describe('Overlay и RouteDrawer', () => {
  const overlay = (size?: 'sm' | 'md' | 'lg', drawer = false) =>
    tags(
      h(Overlay, {
        open: false,
        onClose: noop,
        title: 'Окно',
        drawer,
        ...(size ? { size } : {}),
        children: 'x',
      }),
    ).find((t) => t.tag === 'dialog')!.attrs['class']!;
  it('без size класс прежний, sm и lg добавляют свой', () => {
    expect(overlay().split(/\s+/).filter(Boolean)).toEqual(['ui-overlay']);
    expect(overlay('md').split(/\s+/).filter(Boolean)).toEqual(['ui-overlay']);
    expect(overlay('sm')).toMatch(/\bui-overlay--sm\b/);
    expect(overlay('lg', true)).toMatch(/\bui-drawer\b.*\bui-overlay--lg\b|\bui-overlay--lg\b.*\bui-drawer\b/);
  });
  it('заголовок подписывает окно', () => {
    const list = tags(h(Overlay, { open: false, onClose: noop, title: 'Окно', children: 'x' }));
    const dialog = list.find((t) => t.tag === 'dialog')!;
    const heading = list.find((t) => t.tag === 'h2')!;
    expect(dialog.attrs['aria-labelledby']).toBe(heading.attrs['id']);
  });
  it('размер md окна и панели берётся из токенов, а не литералом', () => {
    const css = readFileSync(resolve(import.meta.dirname, '../app/premium.css'), 'utf8');
    const rule = (selector: string) =>
      css.match(new RegExp(`\\n\\s*${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
    expect(rule('.ui-overlay')).toMatch(/width:\s*min\(var\(--overlay-w-md\),/);
    expect(rule('.ui-drawer')).toMatch(/width:\s*min\(var\(--drawer-w-md\),/);
    expect(rule('.ui-overlay')).not.toMatch(/width:\s*min\(\d+px/);
    expect(rule('.ui-drawer')).not.toMatch(/width:\s*min\(\d+px/);
  });
  it('исходник RouteDrawer передаёт size и не держит ширину своим селектором', () => {
    const source = readFileSync(resolve(import.meta.dirname, 'route-drawer.tsx'), 'utf8');
    expect(source).toMatch(/size=\{size\}/);
    const css = readFileSync(
      resolve(import.meta.dirname, '../app/reservations/new/booking-compact.css'),
      'utf8',
    );
    expect(css).not.toMatch(/\.booking-drawer:has\(\.booking-create\)\s*\{[^}]*width/);
    expect(RouteDrawer).toBeTypeOf('function');
  });
});

describe('Field required', () => {
  const field = (required?: boolean) =>
    html(
      h(Field, {
        label: 'Имя',
        controlId: 'name',
        ...(required === undefined ? {} : { required }),
        children: h(Input, { name: 'firstName' }),
      }),
    );
  it('true: родное required у поля и знак после подписи, не только цветом', () => {
    const markup = field(true);
    expect(markup).toMatch(/<input[^>]*required/);
    expect(markup).toContain('field__label field__label--required');
    expect(markup).not.toContain('*');
    expect(markup).not.toContain('необязательно');
  });
  it('false: слово «необязательно», без required', () => {
    const markup = field(false);
    expect(markup).toContain('необязательно');
    expect(markup).not.toMatch(/<input[^>]*required/);
  });
  it('не задан: разметка прежняя (подпись текстом прямо в label, без меток и required)', () => {
    const markup = field();
    expect(markup).toMatch(/^<label for="name" class="field">Имя<input /);
    expect(markup).not.toContain('field__');
    expect(markup).not.toContain('необязательно');
    expect(markup).not.toMatch(/required/);
  });
});

describe('Table', () => {
  it('новое использование: плотность, липкость и подпись таблицы', () => {
    const markup = html(
      h(Table, {
        density: 'compact',
        sticky: 'both',
        caption: 'Загрузка по ночам',
        captionHidden: true,
        children: h('tbody'),
      }),
    );
    expect(markup).toMatch(/class="tbl tbl--compact tbl--sticky-header tbl--sticky-column"/);
    expect(markup).toMatch(/<caption class="sr-only">Загрузка по ночам<\/caption>/);
    expect(markup).toMatch(/role="region" aria-label="Загрузка по ночам"/);
  });
  it('с aria-label область прокрутки берёт то же имя', () => {
    const markup = html(
      h(Table, { density: 'normal', sticky: 'column', 'aria-label': 'Рынок', children: h('tbody') }),
    );
    expect(markup).toMatch(/role="region" aria-label="Рынок"/);
    expect(markup).toMatch(/class="tbl tbl--sticky-column"/);
  });
  it('прежняя таблица без имени держит общее имя области', () => {
    expect(html(h(Table, { size: 'sm', children: h('tbody') }))).toMatch(
      /aria-label="Таблица, прокрутка по горизонтали"/,
    );
  });
  it('тип: новое использование без имени не собирается', () => {
    // @ts-expect-error density без caption и aria-label
    const bad = h(Table, { density: 'compact', children: h('tbody') });
    expect(bad).toBeTruthy();
  });
});

describe('ErrorState поверх EmptyState', () => {
  const err = (digest?: string) => Object.assign(new Error('x'), digest ? { digest } : {});
  it('та же обёртка, что у EmptyState, с role=alert', () => {
    const markup = html(h(ErrorState, { error: err('API_503'), retry: noop, title: 'Не загрузилось' }));
    const empty = html(h(EmptyState, { title: 'Не загрузилось' }));
    expect(markup.startsWith('<section class="empty-state" role="alert">')).toBe(true);
    expect(empty).toContain('<h3 class="empty-state__title">Не загрузилось</h3>');
    expect(markup).toContain('<h3 class="empty-state__title">Не загрузилось</h3>');
    expect(markup).toContain('Проверьте подключение и повторите запрос.');
    expect(markup).toMatch(/Подключения API/);
    expect(markup).toMatch(/<details><summary>Код ошибки<\/summary>API_503<\/details>/);
  });
  it('отклонённый запрос: совет про адрес, без «Подключения API»', () => {
    const markup = html(h(ErrorState, { error: err('API_404'), retry: noop }));
    expect(markup).toContain('Сервер отклонил запрос (код 404)');
    expect(markup).not.toContain('Подключения API');
    expect(markup).toContain('Повторить загрузку');
  });
  it('исходник ErrorState не держит своей разметки empty-state', () => {
    const source = readFileSync(resolve(import.meta.dirname, 'error-state.tsx'), 'utf8');
    expect(source).not.toContain('className="empty-state"');
    expect(source).toMatch(/<EmptyState/);
  });
});

describe('тема «Контраст» в DS1c не меняется', () => {
  it('наведение главной кнопки в «Контрасте» прежнее blue.600, светлая blue.800, тёмная blue.300', () => {
    const tokens = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../../../../design/tokens.json'), 'utf8'),
    ) as Record<string, unknown>;
    const find = (node: unknown): Record<string, unknown> | undefined => {
      if (!node || typeof node !== 'object') return undefined;
      const obj = node as Record<string, unknown>;
      if ('primary-hover' in obj) return obj['primary-hover'] as Record<string, unknown>;
      for (const v of Object.values(obj)) {
        const hit = find(v);
        if (hit) return hit;
      }
      return undefined;
    };
    const hover = find(tokens)!;
    expect(hover['$value']).toBe('{color.primitive.blue.800}');
    const themes = (hover['$extensions'] as Record<string, Record<string, string>>)['kz.wetop.themes']!;
    expect(themes['dark']).toBe('{color.primitive.blue.300}');
    expect(themes['contrast']).toBe('{color.primitive.blue.600}');
    const css = readFileSync(resolve(import.meta.dirname, '../app/tokens.css'), 'utf8');
    const block = css.slice(css.indexOf("[data-theme='contrast']"));
    const primary = block.match(/--primary:\s*(#[0-9a-f]+)/)?.[1];
    const primaryHover = block.match(/--primary-hover:\s*(#[0-9a-f]+)/)?.[1];
    expect(primaryHover).toBeDefined();
    expect(primaryHover).not.toBe(primary);
  });
});

describe('главная кнопка', () => {
  const css = readFileSync(resolve(import.meta.dirname, '../app/components.css'), 'utf8');
  it('наведение красит --primary-hover, фильтра и градиента нет', () => {
    const btn = css.slice(css.indexOf('/* Кнопка.'), css.indexOf('/* Поле ввода */'));
    expect(btn).not.toMatch(/filter:\s*brightness/);
    expect(btn).not.toMatch(/gradient/);
    expect(btn).toMatch(/:hover[^{]*\{[^}]*background-color:\s*var\(--primary-hover\)/);
  });
});
