'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { intlLocale, msg, type DeskLocale } from '../i18n';
import { useLocale, useT } from '../i18n/locale-provider';
import { Icon } from './icon';
import { dateFormat } from '../i18n/dates';
import { panelBox, panelPlacement } from './panel-placement';

const DAY = 86_400_000;
const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']; // kk-allow: русские месяцы и дни недели для ru; казахские даёт Intl kk-KZ (inLocale ниже)
const months = 'января февраля марта апреля мая июня июля августа сентября октября ноября декабря'.split(' '); // kk-allow: русские месяцы и дни недели для ru; казахские даёт Intl kk-KZ (inLocale ниже)
const monthTitles = 'Январь Февраль Март Апрель Май Июнь Июль Август Сентябрь Октябрь Ноябрь Декабрь'.split(' '); // kk-allow: русские месяцы и дни недели для ru; казахские даёт Intl kk-KZ (inLocale ниже)

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(value: string, amount: number): string {
  return iso(new Date(parseDate(value)!.getTime() + amount * DAY));
}

function monthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function formatDate(value: string): string {
  const date = parseDate(value);
  return date
    ? `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`
    : value;
}

function formatCompactRange(from: string, to: string): string {
  const start = parseDate(from);
  const end = parseDate(to);
  if (!start || !end) return `${from} – ${to}`;
  const firstDay = start.getUTCDate();
  const lastDay = end.getUTCDate();
  const firstYear = start.getUTCFullYear();
  const lastYear = end.getUTCFullYear();
  const firstMonth = start.getUTCMonth();
  const lastMonth = end.getUTCMonth();
  if (from === to) return `${firstDay} ${months[firstMonth]} ${firstYear}`;
  if (firstYear === lastYear && firstMonth === lastMonth)
    return `${firstDay}–${lastDay} ${months[firstMonth]} ${firstYear}`;
  const monthShort = (month: number) => months[month]?.slice(0, 3) ?? '';
  if (firstYear === lastYear)
    return `${firstDay} ${monthShort(firstMonth)} – ${lastDay} ${monthShort(lastMonth)} ${firstYear}`;
  return `${firstDay} ${monthShort(firstMonth)} ${String(firstYear).slice(-2)} – ${lastDay} ${monthShort(lastMonth)} ${String(lastYear).slice(-2)}`;
}

/** самая короткая подпись для телефона: «12–18 окт.», «28 сент. – 4 окт.», без года */
function formatShortRange(from: string, to: string): string {
  const start = parseDate(from);
  const end = parseDate(to);
  if (!start || !end) return `${from} – ${to}`;
  // «мая» и «июня» короче сокращения: пишутся целиком, без точки
  const short = (month: number) => {
    const word = months[month] ?? '';
    return word.length <= 4 ? word : `${word.slice(0, 3)}.`;
  };
  if (from === to) return `${start.getUTCDate()} ${short(start.getUTCMonth())}`;
  if (start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear())
    return `${start.getUTCDate()}–${end.getUTCDate()} ${short(end.getUTCMonth())}`;
  return `${start.getUTCDate()} ${short(start.getUTCMonth())} – ${end.getUTCDate()} ${short(end.getUTCMonth())}`;
}

/** Даты на языке человека не по-русски: месяцы и отрезок собирает `Intl` (казахский порядок слов свой) */
const inLocale = (locale: DeskLocale, options: Intl.DateTimeFormatOptions) =>
  dateFormat(intlLocale(locale), { timeZone: 'UTC', ...options });
const LONG = { day: 'numeric', month: 'long', year: 'numeric' } as const;
function localeRange(from: string, to: string, locale: DeskLocale, options: Intl.DateTimeFormatOptions): string {
  const start = parseDate(from);
  const end = parseDate(to);
  if (!start || !end) return `${from} – ${to}`;
  return inLocale(locale, options).formatRange(start, end);
}
const dateIn = (value: string, locale: DeskLocale) => {
  const date = parseDate(value);
  return locale === 'ru' || !date ? formatDate(value) : inLocale(locale, LONG).format(date);
};
const compactIn = (from: string, to: string, locale: DeskLocale) =>
  locale === 'ru' ? formatCompactRange(from, to) : localeRange(from, to, locale, LONG);
const shortIn = (from: string, to: string, locale: DeskLocale) =>
  locale === 'ru' ? formatShortRange(from, to) : localeRange(from, to, locale, { day: 'numeric', month: 'short' });

export type DateRangePreset = 'today' | 'yesterday' | 'week' | 'month' | '7' | '14' | '30' | 'custom';

export function presetRange(
  preset: DateRangePreset,
  today: string,
): { from: string; to: string } | null {
  const date = parseDate(today);
  if (!date || preset === 'custom') return null;
  if (preset === 'yesterday') {
    const yesterday = addDays(today, -1);
    return { from: yesterday, to: yesterday };
  }
  if (preset === 'week') {
    const monday = addDays(today, -((date.getUTCDay() + 6) % 7));
    return { from: monday, to: addDays(monday, 6) };
  }
  if (preset === 'month') {
    return {
      from: iso(monthStart(date)),
      to: iso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))),
    };
  }
  return { from: today, to: addDays(today, (preset === 'today' ? 1 : Number(preset)) - 1) };
}

function activePreset(from: string, to: string, today: string): DateRangePreset {
  for (const preset of ['today', 'yesterday', 'week', 'month', '7', '14', '30'] as const) {
    const range = presetRange(preset, today);
    if (range?.from === from && range.to === to) return preset;
  }
  return 'custom';
}

// быстрые периоды одни во всех направлениях (владелец 25.10.2026): «Сегодня, Вчера, Эта неделя, Этот месяц» первыми
const presets: { value: DateRangePreset; label: string }[] = [
  { value: 'today', label: msg('Сегодня') },
  { value: 'yesterday', label: msg('Вчера') },
  { value: 'week', label: msg('Эта неделя') },
  { value: 'month', label: msg('Этот месяц') },
  { value: '7', label: msg('7 дней') },
  { value: '14', label: msg('14 дней') },
  { value: '30', label: msg('30 дней') },
  { value: 'custom', label: msg('Произвольный период') },
];

/** Один контрол периода. Today передаёт экран по часовому поясу объекта. */
export function DateRangePopover({
  from,
  to,
  today,
  maxDays,
  action,
  triggerTestId,
  compactOnMobile = false,
  compact = false,
  onDay,
  dayPresets,
  onApply,
}: {
  from: string;
  to: string;
  today: string;
  maxDays?: number;
  action?: string;
  triggerTestId?: string;
  compactOnMobile?: boolean;
  /** короткая подпись на любой ширине («13–19 октября 2026»), как на эталоне шахматки 13.10.2026 */
  compact?: boolean;
  /**
   * Режим «один день» (журнал салона и ресторана, единая шапка 23.10.2026): тот же вид, щелчок по дню сразу
   * переходит, без формы и «Применить»
   */
  onDay?: (date: string) => void;
  /** быстрые дни слева в режиме дня («Сегодня», «Вчера», «Эта неделя», «Этот месяц») */
  dayPresets?: Array<{ label: string; date?: string; onSelect?: () => void }>;
  /**
   * «Применить» переходом внутри приложения (записи салона, владелец 29.10.2026): экран сам строит адрес и сохраняет
   * свои фильтры, история браузера остаётся у приложения (выход из несохранённой записи спрашивает подтверждение)
   */
  onApply?: (range: { from: string; to: string }) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const ref = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);
  const id = useId();
  const [start, setStart] = useState(from);
  const [end, setEnd] = useState(to);
  const [selectedPreset, setSelectedPreset] = useState<DateRangePreset>(() =>
    activePreset(from, to, today),
  );
  const [view, setView] = useState(() =>
    monthStart(parseDate(from) ?? parseDate(today) ?? new Date()),
  );
  const [selectingEnd, setSelectingEnd] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setStart(from);
    setEnd(to);
    setView(monthStart(parseDate(from) ?? parseDate(today) ?? new Date()));
    setSelectedPreset(activePreset(from, to, today));
    setSelectingEnd(false);
    setError('');
    if (ref.current) ref.current.open = false;
  }, [from, to, today]);

  // окно под кнопкой, но всегда внутри экрана (владелец 23.10.2026): на компьютере место считается при открытии,
  // на узком экране работает раскладка из CSS (лист снизу)
  const place = () => {
    const details = ref.current;
    const panel = details?.querySelector<HTMLElement>('.date-range__panel');
    const button = trigger.current?.getBoundingClientRect();
    if (!details?.open || !panel || !button) return;
    if (window.innerWidth <= 960) {
      panel.style.removeProperty('left');
      panel.style.removeProperty('top');
      panel.removeAttribute('data-placed');
      return;
    }
    const { left } = panelPlacement(button, panel.offsetWidth, window.innerWidth);
    // высота по содержимому, а не по уже урезанному окну: иначе при каждом пересчёте окно сжималось бы дальше
    panel.style.removeProperty('max-height');
    const { top, maxHeight } = panelBox(button, panel.scrollHeight, window.innerHeight);
    panel.setAttribute('data-placed', '');
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.maxHeight = `${maxHeight}px`;
  };
  useEffect(() => {
    window.addEventListener('resize', place);
    // прокрутка внутри самого окна его не двигает, двигает только прокрутка страницы под ним
    const onScroll = (event: Event) => {
      const panel = ref.current?.querySelector('.date-range__panel');
      if (panel && event.target instanceof Node && panel.contains(event.target)) return;
      place();
    };
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', onScroll, true);
    };
  });

  useEffect(() => {
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (!ref.current?.open) return;
      if (event instanceof KeyboardEvent) {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        ref.current.open = false;
        trigger.current?.focus();
      } else if (event.target instanceof Node && !ref.current.contains(event.target)) {
        ref.current.open = false;
      }
    };
    document.addEventListener('click', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', close);
    };
  }, []);

  const first = monthStart(view);
  const gridStart = new Date(first.getTime() - ((first.getUTCDay() + 6) % 7) * DAY);
  const days = Array.from(
    { length: 42 },
    (_, index) => new Date(gridStart.getTime() + index * DAY),
  );
  const valid = parseDate(start) && parseDate(end) && start <= end;
  const count = valid
    ? Math.round((parseDate(end)!.getTime() - parseDate(start)!.getTime()) / DAY) + 1
    : 0;
  const chooseDay = (value: string) => {
    if (onDay) {
      if (ref.current) ref.current.open = false;
      onDay(value);
      return;
    }
    setSelectedPreset('custom');
    setError('');
    if (!selectingEnd || value < start) {
      setStart(value);
      setEnd(value);
      setSelectingEnd(true);
    } else {
      setEnd(value);
      setSelectingEnd(false);
    }
  };
  const changeMonth = (amount: number) =>
    setView(new Date(Date.UTC(view.getUTCFullYear(), view.getUTCMonth() + amount, 1)));

  return (
    <details
      className={`date-range${compactOnMobile ? ' date-range--compact-mobile' : ''}`}
      ref={ref}
      onToggle={place}
    >
      <summary
        ref={trigger}
        data-testid={triggerTestId}
        aria-label={onDay ? t('Выбрать день') : t('Выбрать период')}
        aria-controls={`${id}-panel`}
      >
        <Icon name="board" />
        {!compact && !onDay && (
          <span className="date-range__label-full">
            {dateIn(from, locale)} – {dateIn(to, locale)}
          </span>
        )}
        {/* неделя салона выбирает день, а показывает всю неделю */}
        {onDay && (
          <span className="date-range__label-full">
            {from === to ? dateIn(from, locale) : compactIn(from, to, locale)}
          </span>
        )}
        {!onDay && (compact || compactOnMobile) && (
          <span className={compact ? 'date-range__label-wide' : 'date-range__label-compact'}>
            {compactIn(from, to, locale)}
          </span>
        )}
        {compact && !onDay && (
          <span className="date-range__label-short">{shortIn(from, to, locale)}</span>
        )}
        <Icon name="down" />
      </summary>
      <div className="date-range__panel" id={`${id}-panel`}>
        <form
          method="get"
          action={action}
          onSubmit={(event) => {
            if (!valid || (maxDays && count > maxDays)) {
              event.preventDefault();
              setError(!valid ? t('Выберите корректный период') : t('Не более {n} дней', { n: String(maxDays) }));
              return;
            }
            if (onApply) {
              event.preventDefault();
              if (ref.current) ref.current.open = false;
              onApply({ from: start, to: end });
            }
          }}
        >
          <div className="date-range__body">
            <div className="date-range__presets" role="group" aria-label={t('Готовые периоды')}>
              <strong>{onDay ? t('Выберите день') : t('Выберите период')}</strong>
              {onDay &&
                (dayPresets ?? [{ label: msg('Сегодня'), date: today }]).map((preset) => (
                  <button
                    key={t(preset.label)}
                    type="button"
                    className="date-range__preset"
                    aria-pressed={preset.date === from}
                    onClick={() => {
                      if (ref.current) ref.current.open = false;
                      if (preset.onSelect) preset.onSelect();
                      else if (preset.date) onDay(preset.date);
                    }}
                  >
                    {t(preset.label)}
                  </button>
                ))}
              {!onDay && presets.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className="date-range__preset"
                  aria-pressed={selectedPreset === value}
                  onClick={() => {
                    const range = presetRange(value, today);
                    setSelectedPreset(value);
                    setError('');
                    setSelectingEnd(value === 'custom');
                    if (range) {
                      setStart(range.from);
                      setEnd(range.to);
                      setView(monthStart(parseDate(range.from)!));
                    }
                  }}
                >
                  {t(label)}
                </button>
              ))}
            </div>
            <div className="date-range__calendar" aria-label={t('Календарь периода')}>
              <div className="date-range__month">
                <button type="button" onClick={() => changeMonth(-1)} aria-label={t('Предыдущий месяц')}>
                  <Icon name="back" />
                </button>
                <strong>
                  {locale === 'ru' ? (
                    <>
                      {monthTitles[view.getUTCMonth()]} {view.getUTCFullYear()}
                    </>
                  ) : (
                    inLocale(locale, { month: 'long', year: 'numeric' }).format(view)
                  )}
                </strong>
                <button type="button" onClick={() => changeMonth(1)} aria-label={t('Следующий месяц')}>
                  <Icon name="chevron" />
                </button>
              </div>
              <div className="date-range__days">
                {(locale === 'ru'
                  ? weekdays
                  : Array.from({ length: 7 }, (_, i) =>
                      inLocale(locale, { weekday: 'short' }).format(new Date(Date.UTC(2024, 0, 1 + i))),
                    )
                ).map((day) => (
                  <span key={day} className="date-range__weekday">
                    {day}
                  </span>
                ))}
                {days.map((day) => {
                  const value = iso(day);
                  return (
                    <button
                      key={value}
                      type="button"
                      className="date-range__day"
                      data-outside={day.getUTCMonth() !== view.getUTCMonth()}
                      data-in-range={value >= start && value <= end}
                      data-edge={value === start || value === end}
                      data-today={value === today}
                      aria-label={dateIn(value, locale)}
                      aria-pressed={value === start || value === end}
                      onClick={() => chooseDay(value)}
                    >
                      {day.getUTCDate()}
                    </button>
                  );
                })}
              </div>
              {!onDay && (<div className="date-range__inputs">
                <label>
                  {t('С')}
                  <input
                    name="from"
                    type="date"
                    aria-label={t('Период: с')}
                    value={start}
                    onChange={(event) => {
                      setStart(event.target.value);
                      setSelectedPreset('custom');
                      setError('');
                    }}
                    required
                  />
                </label>
                <label>
                  {t('По')}
                  <input
                    name="to"
                    type="date"
                    aria-label={t('Период: по')}
                    value={end}
                    onChange={(event) => {
                      setEnd(event.target.value);
                      setSelectedPreset('custom');
                      setError('');
                    }}
                    required
                  />
                </label>
              </div>)}
            </div>
          </div>
          {!onDay && (<div className="date-range__footer">
            <span aria-live="polite">
              {valid
                ? t('Выбрано: {range} ({count} дн.)', { range: compactIn(start, end, locale), count })
                : t('Выберите даты')}
            </span>
            <span className="date-range__actions">
              <button
                className="btn btn--secondary"
                type="button"
                onClick={() => {
                  // «Отмена» возвращает отрезок экрана и закрывает окно, фокус на кнопку периода
                  setStart(from);
                  setEnd(to);
                  setSelectedPreset(activePreset(from, to, today));
                  setSelectingEnd(false);
                  setError('');
                  if (ref.current) ref.current.open = false;
                  trigger.current?.focus();
                }}
              >
                {t('Отмена')}
              </button>
              <button className="btn" type="submit">
                {t('Применить')}
              </button>
            </span>
            {error && <p role="alert">{error}</p>}
          </div>)}
        </form>
      </div>
    </details>
  );
}
