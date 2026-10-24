import type { DeskLocale } from './index';

/**
 * Даты на языке человека (KK2). Русский это обычный `Intl` ru-RU. Казахский собирается здесь: данные ICU для kk-KZ
 * есть в Node, но не в каждом браузере (Chromium без полного ICU пишет «2026 M10 24»), и экран, отрисованный
 * сервером, расходился с клиентом при гидратации. Числа и пояс считает `Intl` с en-GB (его данные есть везде),
 * слова берутся из таблиц ниже. Порядок как у ICU kk: «2026 ж. 24 қазан, сенбі».
 */
const MONTHS = ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым', 'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан'];
const MONTHS_SHORT = ['қаң.', 'ақп.', 'нау.', 'сәу.', 'мам.', 'мау.', 'шіл.', 'там.', 'қыр.', 'қаз.', 'қар.', 'жел.'];
/** С воскресенья, как `getUTCDay` */
const WEEKDAYS = ['жексенбі', 'дүйсенбі', 'сейсенбі', 'сәрсенбі', 'бейсенбі', 'жұма', 'сенбі'];
const WEEKDAYS_SHORT = ['жс', 'дс', 'сс', 'ср', 'бс', 'жм', 'сб'];
const EN_WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface DateFormat {
  format(date: Date): string;
  formatRange(from: Date, to: Date): string;
}

type Locale = DeskLocale | 'ru-RU' | 'kk-KZ' | 'en-GB';

export function dateFormat(locale: Locale, options: Intl.DateTimeFormatOptions = {}): DateFormat {
  if (locale === 'ru' || locale === 'ru-RU') return new Intl.DateTimeFormat('ru-RU', options);
  // английские данные ICU есть в каждом браузере и в Node: день перед месяцем и 24 часа, как в Казахстане
  if (locale === 'en' || locale === 'en-GB') return new Intl.DateTimeFormat('en-GB', options);
  return kazakh(options);
}

function kazakh(raw: Intl.DateTimeFormatOptions): DateFormat {
  const options: Intl.DateTimeFormatOptions =
    raw.dateStyle === 'long' || raw.dateStyle === 'full'
      ? { timeZone: raw.timeZone, year: 'numeric', month: 'long', day: 'numeric', ...(raw.dateStyle === 'full' ? { weekday: 'long' } : {}) }
      : raw;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: options.timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const read = (date: Date) => {
    const p = Object.fromEntries(parts.formatToParts(date).map((x) => [x.type, x.value]));
    return {
      year: Number(p.year),
      month: Number(p.month) - 1,
      day: Number(p.day),
      weekday: EN_WEEKDAY.indexOf(p.weekday ?? ''),
      time: `${p.hour}:${p.minute}`,
    };
  };
  const pad = (n: number) => String(n).padStart(2, '0');
  const numeric = options.month === 'numeric' || options.month === '2-digit';
  const dayText = (d: ReturnType<typeof read>) =>
    options.day ? (options.day === '2-digit' ? pad(d.day) : String(d.day)) : '';
  const monthText = (d: ReturnType<typeof read>) =>
    options.month === 'long' ? MONTHS[d.month]! : options.month === 'short' || options.month === 'narrow' ? MONTHS_SHORT[d.month]! : '';
  const withYearWeekday = (core: string, d: ReturnType<typeof read>) => {
    let text = options.year ? (core ? `${d.year} ж. ${core}` : `${d.year} ж.`) : core;
    if (options.weekday) {
      const word = (options.weekday === 'long' ? WEEKDAYS : WEEKDAYS_SHORT)[d.weekday]!;
      text = text ? `${text}, ${word}` : word;
    }
    return text;
  };
  const dateText = (d: ReturnType<typeof read>) => {
    if (numeric)
      return [dayText(d) || null, pad(d.month + 1), options.year ? String(d.year) : null].filter(Boolean).join('.');
    return withYearWeekday([dayText(d), monthText(d)].filter(Boolean).join(' '), d);
  };
  const timed = options.hour !== undefined || options.minute !== undefined;
  const format = (date: Date) => {
    const d = read(date);
    const text = dateText(d);
    return timed ? (text ? `${text} ${d.time}` : d.time) : text;
  };
  return {
    format,
    formatRange(from, to) {
      const a = read(from);
      const b = read(to);
      if (!numeric && !timed && !options.weekday && options.day && a.year === b.year && a.month === b.month)
        return withYearWeekday(`${dayText(a)}–${dayText(b)} ${monthText(b)}`.trim(), b);
      return format(from) === format(to) ? format(from) : `${format(from)} – ${format(to)}`;
    },
  };
}
