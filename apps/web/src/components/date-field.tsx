'use client';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
} from 'react';
import { Icon } from './icon';
import { usePropertyClock } from './property-time';
import { cx } from './ui';

const MONTHS = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
];
const MONTHS_OF = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];
const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
/** размеры всплывающего календаря (см. .date-field__pop): нужны, чтобы не выйти за окно */
const POP_W = 296;
const POP_H = 372;
const DAY = 86_400_000;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const parse = (s: string | null | undefined) =>
  s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : null;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
const monthStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
const addMonths = (d: Date, n: number) => {
  const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(d.getUTCDate(), last)),
  );
};
/** Шесть недель с понедельника, покрывающие месяц: календарь не прыгает по высоте */
function weeksOf(month: Date): Date[][] {
  const first = monthStart(month);
  const shift = (first.getUTCDay() + 6) % 7; // понедельник — 0
  const start = addDays(first, -shift);
  return Array.from({ length: 6 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)),
  );
}
const dayLabel = (d: Date) =>
  `${d.getUTCDate()} ${MONTHS_OF[d.getUTCMonth()]} ${d.getUTCFullYear()}`;

/**
 * Поле даты с календарём (DESIGN.md §8). Родное `<input type="date">` остаётся: ввод с клавиатуры,
 * `name` для формы, подписи и `fill()` в тестах — те же. Кнопка справа открывает месяц в стиле стойки;
 * выбор пишет значение в родное поле и шлёт `input`/`change`, чтобы формы и React узнали о нём.
 * На телефоне (≤ 600 px, грубый указатель) кнопки нет — там удобнее родной календарь системы (CSS).
 */
export function DateInput({
  className,
  rangeFromName,
  defaultOpen,
  id: givenId,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & {
  /** имя парного поля «с» в той же форме: дни от его даты до выбранной подсвечиваются отрезком */
  rangeFromName?: string | undefined;
  /** календарь раскрыт сразу — только для страницы `/design-system` */
  defaultOpen?: boolean | undefined;
}) {
  const autoId = useId();
  const popId = `${autoId}-calendar`;
  // Сегодня по часам объекта, как считает остальная стойка (С-13): пояс — из настроек объекта
  const clock = usePropertyClock();
  const hotelToday = () => clock.today();
  const initial =
    parse(typeof rest.defaultValue === 'string' ? rest.defaultValue : null) ?? parse(hotelToday())!;
  const [open, setOpen] = useState(!!defaultOpen);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [view, setView] = useState<Date>(() => monthStart(initial));
  const [cursor, setCursor] = useState<Date>(() => initial);
  const [hover, setHover] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  /** где стояло поле, когда календарь открыли: сдвинулось — координаты календаря устарели */
  const anchor = useRef<{ top: number; left: number } | null>(null);

  const rangeFrom = () => {
    if (!rangeFromName || !input.current?.form) return null;
    const el = input.current.form.elements.namedItem(rangeFromName);
    return el instanceof HTMLInputElement ? parse(el.value) : null;
  };

  const show = () => {
    const current = parse(input.current?.value) ?? rangeFrom() ?? parse(hotelToday())!;
    setCursor(current);
    setView(monthStart(current));
    setHover(null);
    // Календарь стоит в координатах окна (position: fixed): так он не обрезается прокруткой
    // панели брони и не упирается в края окна — у правого края открывается влево от поля,
    // у нижнего — над полем
    const box = input.current?.getBoundingClientRect();
    anchor.current = box ? { top: box.top, left: box.left } : null;
    if (box) {
      const left = box.left + POP_W > window.innerWidth ? Math.max(8, box.right - POP_W) : box.left;
      const below = box.bottom + 4;
      const top =
        below + POP_H > window.innerHeight && box.top - 4 - POP_H > 0 ? box.top - 4 - POP_H : below;
      setPos({ top, left });
    }
    setOpen(true);
  };
  const close = (focusButton = true) => {
    setOpen(false);
    if (focusButton) button.current?.focus();
  };

  // Поле обычно лежит внутри <label> (Field): имя поля для программы чтения собирается из всего
  // текста подписи — вместе с «Открыть календарь» у кнопки, и «Заезд» превращается в «Заезд Открыть
  // календарь». Даём полю подпись без кнопки — тем же словом, что стоит в <label>.
  useEffect(() => {
    const el = input.current;
    const label = el?.closest('label');
    if (!el || !label || el.getAttribute('aria-label')) return;
    const text = Array.from(label.childNodes)
      .filter((n) => !(n instanceof Element && n.contains(el)))
      .map((n) => n.textContent ?? '')
      .join('')
      .trim();
    if (text) el.setAttribute('aria-label', text);
  }, []);
  useEffect(() => {
    if (!open || defaultOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!pop.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node))
        setOpen(false);
    };
    // прокрутка страницы или панели и смена размера окна закрывают календарь, если поле и вправду
    // сдвинулось: его координаты в окне устарели. Сам факт события — нет: панель брони отдаёт
    // `scroll` уже от вставки календаря в разметку, не сдвигая ничего
    const onMove = () => {
      const box = input.current?.getBoundingClientRect();
      const was = anchor.current;
      if (!box || !was || Math.abs(box.top - was.top) > 1 || Math.abs(box.left - was.left) > 1)
        close();
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open, defaultOpen]);
  // показать в верхнем слое; без поддержки Popover API остаётся обычный fixed у своего места
  useEffect(() => {
    const el = pop.current;
    if (open && !defaultOpen && el && typeof el.showPopover === 'function') {
      try {
        el.showPopover();
      } catch {
        /* уже показан */
      }
    }
  }, [open, defaultOpen]);
  // фокус — на дне под курсором (после смены месяца с клавиатуры кнопка новая, поэтому по ключу)
  useEffect(() => {
    // без прокрутки: календарь стоит в координатах окна, а прокрутка панели закрыла бы его
    if (open && !defaultOpen)
      pop.current
        ?.querySelector<HTMLButtonElement>(`[data-date="${iso(cursor)}"]`)
        ?.focus({ preventScroll: true });
  }, [open, cursor, defaultOpen]);

  const select = (d: Date) => {
    const el = input.current;
    if (!el) return;
    // родное поле — как если бы дату ввёл человек: React слушает `input`, GET-форма читает value
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(el, iso(d));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    close();
  };
  const moveCursor = (d: Date) => {
    setCursor(d);
    if (d.getUTCMonth() !== view.getUTCMonth() || d.getUTCFullYear() !== view.getUTCFullYear())
      setView(monthStart(d));
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, () => Date> = {
      ArrowLeft: () => addDays(cursor, -1),
      ArrowRight: () => addDays(cursor, 1),
      ArrowUp: () => addDays(cursor, -7),
      ArrowDown: () => addDays(cursor, 7),
      PageUp: () => addMonths(cursor, -1),
      PageDown: () => addMonths(cursor, 1),
      Home: () => addDays(cursor, -((cursor.getUTCDay() + 6) % 7)),
      End: () => addDays(cursor, 6 - ((cursor.getUTCDay() + 6) % 7)),
    };
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    const next = step[e.key];
    if (!next) return;
    e.preventDefault();
    moveCursor(next());
  };

  const min = parse(typeof rest.min === 'string' ? rest.min : null);
  const max = parse(typeof rest.max === 'string' ? rest.max : null);
  const selected = open ? parse(input.current?.value) : null;
  const today = hotelToday();
  const from = open ? rangeFrom() : null;
  const rangeEnd = hover ? parse(hover) : (selected ?? cursor);
  const inRange = (d: Date) =>
    !!from && !!rangeEnd && from.getTime() <= d.getTime() && d.getTime() <= rangeEnd.getTime();

  return (
    <span className={cx('date-field', className)}>
      <input ref={input} type="date" className="inp date-field__input" id={givenId} {...rest} />
      <button
        ref={button}
        type="button"
        className="date-field__button"
        aria-label="Открыть календарь"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        onClick={(e) => {
          e.preventDefault();
          if (open) close();
          else show();
        }}
      >
        <Icon name="board" width={16} height={16} />
      </button>
      {open && (
        <div
          ref={pop}
          id={popId}
          className={cx('date-field__pop', defaultOpen && 'date-field__pop--inline')}
          // верхний слой браузера (Popover API): панель брони стоит с backdrop-filter, и обычный
          // position: fixed внутри неё считался бы от панели, а не от окна. В каталоге — в потоке
          popover={defaultOpen ? undefined : 'manual'}
          style={pos && !defaultOpen ? { top: pos.top, left: pos.left } : undefined}
          role="dialog"
          aria-label="Календарь"
          onKeyDown={onKey}
          onMouseLeave={() => setHover(null)}
        >
          <div className="date-field__head">
            <button
              type="button"
              className="date-field__nav date-field__nav--prev"
              aria-label="Предыдущий месяц"
              onClick={(e) => {
                e.preventDefault();
                setView(addMonths(view, -1));
              }}
            >
              <Icon name="chevron" width={16} height={16} />
            </button>
            <strong aria-live="polite">
              {MONTHS[view.getUTCMonth()]} {view.getUTCFullYear()}
            </strong>
            <button
              type="button"
              className="date-field__nav"
              aria-label="Следующий месяц"
              onClick={(e) => {
                e.preventDefault();
                setView(addMonths(view, 1));
              }}
            >
              <Icon name="chevron" width={16} height={16} />
            </button>
          </div>
          <table className="date-field__grid" role="grid" aria-label="Дни месяца">
            <thead>
              <tr>
                {WEEKDAYS.map((w) => (
                  <th key={w} scope="col">
                    {w}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeksOf(view).map((week) => (
                <tr key={iso(week[0]!)}>
                  {week.map((d) => {
                    const key = iso(d);
                    const isSelected = !!selected && key === iso(selected);
                    const disabled =
                      (!!min && d.getTime() < min.getTime()) ||
                      (!!max && d.getTime() > max.getTime());
                    return (
                      <td key={key} role="gridcell" aria-selected={isSelected}>
                        <button
                          type="button"
                          data-date={key}
                          className={cx(
                            'date-field__day',
                            d.getUTCMonth() !== view.getUTCMonth() && 'is-other',
                            key === today && 'is-today',
                            isSelected && 'is-selected',
                            inRange(d) && 'is-range',
                          )}
                          tabIndex={key === iso(cursor) ? 0 : -1}
                          aria-label={dayLabel(d)}
                          aria-current={key === today ? 'date' : undefined}
                          disabled={disabled}
                          onClick={(e) => {
                            // внутри <label> щелчок по уже снятой кнопке активирует подпись
                            // и уводит фокус в поле — не даём ему дойти до подписи
                            e.preventDefault();
                            select(d);
                          }}
                          onMouseEnter={() => setHover(key)}
                          onFocus={() => {
                            if (key !== iso(cursor)) setCursor(d);
                          }}
                        >
                          {d.getUTCDate()}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="date-field__foot">
            <button
              type="button"
              className="btn btn--ghost btn--xs"
              onClick={(e) => {
                e.preventDefault();
                select(parse(today)!);
              }}
            >
              Сегодня
            </button>
          </div>
        </div>
      )}
    </span>
  );
}
