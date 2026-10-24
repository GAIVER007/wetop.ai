import type { Incident } from '../../lib/api';
import { countLabel, msg, translator, type DeskLocale, type Translate } from '../../i18n';

/**
 * Слова экрана «Неисправности»: сколько держится, что уже сделал сторож и в каком порядке читать список.
 * Вынесено из разметки, потому что это правила чтения, а не оформление, — и потому что их проверяет тест.
 */

/** Что в строке несёт смысл: у ошибки API это повторы, у остального — время, которое она держится */
export type IncidentView = Pick<
  Incident,
  | 'kind'
  | 'class'
  | 'severity'
  | 'status'
  | 'occurrences'
  | 'firstSeenAt'
  | 'lastSeenAt'
  | 'fixAttempts'
  | 'lastFixResult'
>;

/**
 * Сколько держится неисправность — словами: «20 ч 30 мин», а не «1230 мин».
 *
 * 1226 минут на экране владельца 21.09.2026 нужно было делить в уме: сутки это уже или ещё нет.
 */
export function heldForWords(ms: number, locale: DeskLocale = 'ru', t: Translate = translator(locale)): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return t('меньше минуты');
  if (minutes < 60) return t('{n} мин', { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return rest ? t('{h} ч {m} мин', { h: hours, m: rest }) : t('{h} ч', { h: hours });
  }
  const days = countLabel(locale, t, Math.floor(hours / 24), [msg('день'), 'дня', msg('дней')]); // kk-allow: форма склонения
  const rest = hours % 24;
  return rest ? t('{days} {h} ч', { days, h: rest }) : days;
}

/** Сколько неисправность держится по её же меткам времени; отрицательное время — ноль */
export const heldFor = (i: Pick<Incident, 'firstSeenAt' | 'lastSeenAt'>): number =>
  Math.max(0, Date.parse(i.lastSeenAt) - Date.parse(i.firstSeenAt));

const STATUS_WEIGHT: Record<Incident['status'], number> = {
  ESCALATED: 0,
  OPEN: 1,
  FIXING: 2,
  ACKNOWLEDGED: 3,
  RESOLVED: 4,
};

/**
 * Порядок открытых: срочные выше, потом те, что ждут человека, взятые в работу — вниз; при равенстве
 * первой идёт та, что висит дольше. Порядок API — по времени записи, и срочная уезжала под несрочную.
 */
export function incidentOrder(a: IncidentView, b: IncidentView): number {
  const severity = Number(b.severity === 'CRITICAL') - Number(a.severity === 'CRITICAL');
  if (severity) return severity;
  const status = STATUS_WEIGHT[a.status] - STATUS_WEIGHT[b.status];
  if (status) return status;
  return Date.parse(a.firstSeenAt) - Date.parse(b.firstSeenAt);
}

/** Кто отвечает за неисправность и что сторож уже сделал — одной фразой вместо колонки «не его класс» */
export function guardWords(
  i: Pick<Incident, 'class' | 'fixAttempts' | 'lastFixResult'>,
  locale: DeskLocale = 'ru',
  t: Translate = translator(locale),
): string {
  const result = i.lastFixResult ? t(', последняя попытка — {result}', { result: i.lastFixResult }) : '';
  if (i.class === 'A')
    return i.fixAttempts > 0
      ? t('Чинит сторож: {attempts}{result}.', {
          attempts: countLabel(locale, t, i.fixAttempts, [msg('попытка'), 'попытки', msg('попыток')]), // kk-allow: форма склонения
          result,
        })
      : t('Чинит сторож — попыток ещё не было.');
  const who =
    i.class === 'B'
      ? t('Решает человек: сторож такие неисправности не чинит.')
      : t('Исправляет дежурный агент: это ошибка программы.');
  return i.lastFixResult ? t('{who} Сторож записал: {result}.', { who, result: i.lastFixResult }) : who;
}

/** Сколько раз повторилась или сколько держится — то из двух, что для этого вида имеет смысл */
export function repeatWords(i: IncidentView, locale: DeskLocale = 'ru', t: Translate = translator(locale)): string {
  if (i.kind === 'api.error')
    return i.occurrences > 1
      ? // одна и та же форма «раз» для 1 и 5: в английском «times», повтор здесь всегда больше одного
        t('Повторилась {times}.', { times: countLabel(locale, t, i.occurrences, [msg('раз'), 'раза', msg('раз')]) }) // kk-allow: форма склонения
      : '';
  const ms = heldFor(i);
  return ms >= 60_000 ? t('Держится {time}.', { time: heldForWords(ms, locale, t) }) : '';
}

const HEADLINE_MAX = 120;

/**
 * Заголовок неисправности словами (13.10.2026): сторож пишет в title сырой текст ошибки с путями и стеком, владелец
 * видел его целиком. Понятная часть идёт до « — » (так сторож отделяет суть от подробностей), длинный текст без
 * разделителя обрезается. Полный текст остаётся в раскрывающихся подробностях: дежурному он нужен.
 */
export function incidentHeadline(title: string): { headline: string; details: string | null } {
  const clean = title.trim();
  const cut = clean.indexOf(' — ');
  if (cut > 0) return { headline: clean.slice(0, cut).trim(), details: clean };
  if (clean.length > HEADLINE_MAX)
    return { headline: `${clean.slice(0, HEADLINE_MAX).trimEnd()}…`, details: clean };
  return { headline: clean, details: null };
}
