import type { OpeningInput, OpeningRow } from '../../lib/opening-api';
import { msg } from '../../i18n';
/** Тексты ошибок размечены `msg`: переводит тот, кто показывает (форма и серверное действие) */
export function openingInput(input: OpeningInput): OpeningInput {
 const day = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s;
 if (!day(input.effectiveFrom) || !day(input.effectiveTo) || input.effectiveTo < input.effectiveFrom || Date.parse(input.effectiveTo)-Date.parse(input.effectiveFrom)>366*86400000) throw new Error(msg('Укажите корректный период действия, не больше 367 дней.'));
 if (input.intervals.length>100 || input.closures.length>367) throw new Error(msg('Слишком много интервалов или закрытых дат.'));
 for (const i of input.intervals) {
  if (!Number.isInteger(i.weekday) || i.weekday<0 || i.weekday>6 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(i.localStart) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(i.localEnd) || typeof i.endsNextDay !== 'boolean' || (i.endsNextDay ? i.localEnd>i.localStart : i.localEnd<=i.localStart)) throw new Error(msg('Проверьте часы и явно укажите переход на следующий день (не больше 24 часов).'));
 }
 const seen = new Set<string>();
 for (const c of input.closures) {
  if (!day(c.day) || c.day<input.effectiveFrom || Date.parse(c.day)>Date.parse(input.effectiveTo)+86400000 || !c.reason.trim() || c.reason.length>500 || seen.has(c.day)) throw new Error(msg('Проверьте закрытые даты: дата в периоде (или следующий день), уникальная, с причиной до 500 символов.'));
  seen.add(c.day);
 }
 return { effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo, intervals: input.intervals.map(i=>({weekday:i.weekday,localStart:i.localStart,localEnd:i.localEnd,endsNextDay:i.endsNextDay})), closures: input.closures.map(c=>({day:c.day,reason:c.reason.trim()})) };
}
export function openingDraft(row: OpeningRow | null): OpeningInput {
 return row ? { effectiveFrom:row.effective_from.slice(0,10), effectiveTo:row.effective_to.slice(0,10), intervals:row.intervals.map(i=>({weekday:i.weekday,localStart:i.local_start.slice(0,5),localEnd:i.local_end.slice(0,5),endsNextDay:i.ends_next_day})), closures:row.closures.map(c=>({day:c.day.slice(0,10),reason:c.reason})) } : {effectiveFrom:'',effectiveTo:'',intervals:[],closures:[]};
}
