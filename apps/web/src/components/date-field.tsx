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
const DAY = 86_400_000;

/** Сегодня по часам объекта (Asia/Almaty, UTC+5) — как считает остальная стойка */
const hotelToday = () => new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10);
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
  const initial =
    parse(typeof rest.defaultValue === 'string' ? rest.defaultValue : null) ?? parse(hotelToday())!;
  const [open, setOpen] = useState(!!defaultOpen);
  const [alignRight, setAlignRight] = useState(false);
  const [view, setView] = useState<Date>(() => monthStart(initial));
  const [cursor, setCursor] = useState<Date>(() => initial);
  const [hover, setHover] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);

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
    // календарь 296 px: у поля возле правого края окна открываем к левому краю поля
    const box = input.current?.getBoundingClientRect();
    setAlignRight(!!box && box.left + 296 > window.innerWidth);
    setOpen(true);
  };
  const close = (focusButton = true) => {
    setOpen(false);
    if (focusButton) button.current?.focus();
  };

  useEffect(() => {
    if (!open || defaultOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!pop.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, defaultOpen]);
  // фокус — на дне под курсором (после смены месяца с клавиатуры кнопка новая, поэтому по ключу)
  useEffect(() => {
    if (open && !defaultOpen)
      pop.current?.querySelector<HTMLButtonElement>(`[data-date="${iso(cursor)}"]`)?.focus();
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
          className={cx('date-field__pop', alignRight && 'date-field__pop--right')}
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
