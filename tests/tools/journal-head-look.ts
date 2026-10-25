import type { Page } from '@playwright/test';

/**
 * Шапка журнала как у календаря гостиницы (владелец 24.10.2026: «гостиницы норм выглядит правильно, а салон как-то
 * криво, сделай всё так же, как в гостиницах»). Замер календаря гостиницы (tests/ui/journal-parity-hotel.spec.ts):
 * отступы страницы 16/24 px, все поля и кнопки строки отборов высотой --control-h и шрифтом --text-sm, выборы слева
 * от поиска, «Фильтры» со значком, «Новая …» со значком плюса, без второго значка лупы в шапке, на низком экране
 * (меньше 900 px) подзаголовок скрыт и заголовок --text-3xl. Общий замер для салона, ресторана и гостиницы.
 */
export async function journalHeadLook(page: Page) {
  return page.evaluate(() => {
    const probe = (prop: 'height' | 'fontSize', value: string) => {
      const el = document.createElement('i');
      el.style.position = 'absolute';
      el.style.display = 'block';
      el.style[prop] = value;
      document.body.append(el);
      const c = getComputedStyle(el)[prop];
      el.remove();
      return c;
    };
    const shown = (el: Element | null | undefined): el is HTMLElement => !!el && (el as HTMLElement).getClientRects().length > 0;
    const page = document.querySelector<HTMLElement>('.page.journal-page, .page--board.calendar-page')!;
    const row = document.querySelector<HTMLElement>('.journal-head__filters, .board-toolbar')!;
    const controls = [...row.querySelectorAll<HTMLElement>(':scope > input, :scope > label input, :scope > .journal-search > input, :scope > select, :scope > details > summary, :scope > .employee-filter > summary, :scope > .field input, :scope > .board-filters-open, :scope > span > details > summary')]
      .filter(shown);
    const search = [...row.querySelectorAll<HTMLElement>('input[type="search"]')].find(shown)!;
    const selects = [...row.querySelectorAll<HTMLElement>('select, .employee-filter > summary')].filter(shown);
    const filtersButton = [...row.querySelectorAll<HTMLElement>('summary, button')].filter(shown).find((b) => /^Фильтры/.test(b.textContent?.trim() ?? ''));
    const create = [...document.querySelectorAll<HTMLElement>('main a, main button')].find((b) => /Новая (бронь|запись)/.test(b.textContent ?? ''));
    const title = document.querySelector<HTMLElement>('.journal-head__title, .page--board .page__title');
    const subtitle = document.querySelector<HTMLElement>('.journal-head__subtitle, .calendar-page .page__subtitle');
    const pc = getComputedStyle(page);
    return {
      padding: `${pc.paddingTop} ${pc.paddingLeft}`,
      controlH: probe('height', 'var(--control-h)'),
      textSm: probe('fontSize', 'var(--text-sm)'),
      text3xl: probe('fontSize', 'var(--text-3xl)'),
      text4xl: probe('fontSize', 'var(--text-4xl)'),
      heights: controls.map((c) => `${(c.getAttribute('aria-label') || c.textContent || '').trim().slice(0, 16)}=${getComputedStyle(c).height}`),
      fonts: controls.map((c) => `${(c.getAttribute('aria-label') || c.textContent || '').trim().slice(0, 16)}=${getComputedStyle(c).fontSize}`),
      selectsLeftOfSearch: selects.length > 0 && selects.every((s) => s.getBoundingClientRect().x < search.getBoundingClientRect().x),
      filtersIcon: !!filtersButton?.querySelector('svg'),
      filtersShown: !!filtersButton,
      createIcon: !!create?.querySelector('svg'),
      lupa: shown(document.querySelector('.workspace-search--icon')),
      subtitleShown: shown(subtitle),
      titleFont: title ? getComputedStyle(title).fontSize : null,
    };
  });
}
