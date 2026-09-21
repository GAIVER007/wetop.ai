import type { Incident } from '../../lib/api';
import { pluralRu } from '../../lib/plural';

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
export function heldForWords(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'меньше минуты';
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
  }
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  return rest
    ? `${pluralRu(days, ['день', 'дня', 'дней'])} ${rest} ч`
    : pluralRu(days, ['день', 'дня', 'дней']);
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
export function guardWords(i: Pick<Incident, 'class' | 'fixAttempts' | 'lastFixResult'>): string {
  const result = i.lastFixResult ? `, последняя попытка — ${i.lastFixResult}` : '';
  if (i.class === 'A')
    return i.fixAttempts > 0
      ? `Чинит сторож: ${pluralRu(i.fixAttempts, ['попытка', 'попытки', 'попыток'])}${result}.`
      : 'Чинит сторож — попыток ещё не было.';
  const who =
    i.class === 'B'
      ? 'Решает человек: сторож такие неисправности не чинит.'
      : 'Исправляет дежурный агент: это ошибка программы.';
  return i.lastFixResult ? `${who} Сторож записал: ${i.lastFixResult}.` : who;
}

/** Сколько раз повторилась или сколько держится — то из двух, что для этого вида имеет смысл */
export function repeatWords(i: IncidentView): string {
  if (i.kind === 'api.error')
    return i.occurrences > 1
      ? `Повторилась ${pluralRu(i.occurrences, ['раз', 'раза', 'раз'])}.`
      : '';
  const ms = heldFor(i);
  return ms >= 60_000 ? `Держится ${heldForWords(ms)}.` : '';
}
