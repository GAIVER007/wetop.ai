'use client';
import { useEffect, useRef, type MouseEvent } from 'react';
import type { FoodWorkspace, RestaurantReservation } from '../../lib/food-types';
import { foodStatus } from '../../lib/status/food';
import { pluralRu } from '../../lib/plural';
import { localInput } from '../beauty/time';
import { compareTables, tableTitle } from '../../lib/table-title';

/** Брони, которые держат стол на шкале: отменённые и неявки строку не занимают */
const ON_TIMELINE = new Set(['BOOKED', 'CONFIRMED', 'SEATED', 'COMPLETED']);

export { tableTitle } from '../../lib/table-title';

/** Минуты от полуночи дня экрана по поясу филиала; бронь через полночь даёт больше 1440 */
export function minutesOfDay(iso: string, day: string, timezone: string): number {
  const local = localInput(iso, timezone);
  const days =
    (Date.UTC(+local.slice(0, 4), +local.slice(5, 7) - 1, +local.slice(8, 10)) -
      Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10))) /
    86_400_000;
  return days * 1440 + Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16));
}

/** Часы шкалы: от начала самого раннего периода до конца самого позднего (смена после полуночи
 * продлевает шкалу за 24:00), расширено бронями дня; без периодов 10:00–24:00 */
export function timelineHours(
  periods: FoodWorkspace['periods'],
  spans: Array<[number, number]>,
): [number, number] {
  const hm = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const active = periods.filter((p) => p.active);
  let from = active.length ? Math.min(...active.map((p) => hm(p.timeFrom))) : 600;
  let to = active.length
    ? Math.max(...active.map((p) => hm(p.timeTo) + (p.endsNextDay ? 1440 : 0)))
    : 1440;
  for (const [s, e] of spans) {
    from = Math.min(from, s);
    to = Math.max(to, e);
  }
  from = Math.max(0, Math.floor(from / 60));
  to = Math.min(48, Math.max(from + 1, Math.ceil(to / 60)));
  return [from, to];
}

/** «Календарь бронирований» по макету (экран 3): строки столы, столбцы часы, бронь полосой своей длины */
export function TimelineBoard({
  data,
  reservations,
  areaId,
  onOpen,
  onCreate,
}: {
  data: FoodWorkspace;
  reservations: RestaurantReservation[];
  areaId: string;
  onOpen: (r: RestaurantReservation) => void;
  onCreate: ((tableId: string, time: string) => void) | null;
}) {
  const areaOrder = new Map(data.areas.map((a) => [a.id, a.sortOrder]));
  const areaName = new Map(data.areas.map((a) => [a.id, a.name]));
  const tables = data.tables
    .filter(
      (t) =>
        t.active &&
        data.areas.some((a) => a.id === t.areaId && a.active) &&
        (!areaId || t.areaId === areaId),
    )
    .sort(
      (a, b) =>
        (areaOrder.get(a.areaId) ?? 0) - (areaOrder.get(b.areaId) ?? 0) || compareTables(a, b),
    );
  const placed = reservations
    .filter((r) => r.table && ON_TIMELINE.has(r.status))
    .map((r) => ({
      r,
      start: minutesOfDay(r.startsAt, data.date, data.timezone),
      end: minutesOfDay(r.endsAt, data.date, data.timezone),
    }));
  const [fromHour, toHour] = timelineHours(
    data.periods,
    placed.map((p) => [p.start, p.end]),
  );
  const span = (toHour - fromHour) * 60;
  const pct = (m: number) => `${(((m - fromHour * 60) / span) * 100).toFixed(3)}%`;
  const today = localInput(new Date().toISOString(), data.timezone);
  const nowMinutes =
    today.slice(0, 10) === data.date
      ? Number(today.slice(11, 13)) * 60 + Number(today.slice(14, 16))
      : null;
  const hours = Array.from({ length: toHour - fromHour }, (_, i) => fromHour + i);
  const clock = (iso: string) => localInput(iso, data.timezone).slice(11, 16);
  const pick = (e: MouseEvent<HTMLButtonElement>, tableId: string) => {
    if (!onCreate) return;
    const box = e.currentTarget.getBoundingClientRect();
    // щелчок мышью: время под курсором, шаг 15 минут; с клавиатуры (detail 0): время экрана
    const minute =
      e.detail === 0
        ? null
        : fromHour * 60 + Math.floor((((e.clientX - box.left) / box.width) * span) / 15) * 15;
    const time =
      minute === null
        ? data.time
        : `${String(Math.floor(minute / 60) % 24).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
    onCreate(tableId, time);
  };
  // узкий экран: шкала сразу показывает текущее время (или первую бронь дня) за час до него
  const scroller = useRef<HTMLDivElement>(null);
  const focusMinute = nowMinutes ?? (placed.length ? Math.min(...placed.map((p) => p.start)) : null);
  useEffect(() => {
    const box = scroller.current;
    const track = box?.querySelector<HTMLElement>('.rest-tl__track');
    if (!box || !track || focusMinute === null || box.scrollWidth <= box.clientWidth) return;
    const offset = ((focusMinute - 60 - fromHour * 60) / span) * track.offsetWidth;
    box.scrollLeft = Math.max(0, offset);
  }, [focusMinute, fromHour, span]);
  if (!tables.length) return <p className="muted">В выбранном зале нет столов</p>;
  return (
    <div className="rest-tl" data-testid="reservations-timeline" ref={scroller}>
      <div
        className="rest-tl__grid"
        style={{ ['--tl-hours' as string]: String(hours.length) }} /* slop-allow: inline-style число часов шкалы из периодов */
        role="group"
        aria-label="Шкала броней по столам"
      >
        <div className="rest-tl__corner">Столы</div>
        <div className="rest-tl__hours" aria-hidden="true">
          {hours.map((h) => (
            <span key={h}>{`${String(h % 24).padStart(2, '0')}:00`}</span>
          ))}
        </div>
        {tables.map((t) => (
          <div className="rest-tl__row" key={t.id}>
            <div className="rest-tl__table">
              <strong>{tableTitle(t.name)}</strong> <small>({t.capacity})</small>
              {!areaId && <span className="sr-only">, {areaName.get(t.areaId)}</span>}
            </div>
            <div className="rest-tl__track">
              {onCreate && (
                <button
                  type="button"
                  className="rest-tl__slot"
                  aria-label={`Новая бронь: ${tableTitle(t.name)}`}
                  onClick={(e) => pick(e, t.id)}
                />
              )}
              {placed
                .filter((p) => p.r.table!.id === t.id && p.end > fromHour * 60 && p.start < toHour * 60)
                .map(({ r, start, end }) => {
                  const name = [r.customer.firstName, r.customer.lastName].filter(Boolean).join(' ');
                  const left = pct(Math.max(start, fromHour * 60));
                  const place = { left, width: `calc(${pct(Math.min(end, toHour * 60))} - ${left})` };
                  return (
                    <button
                      type="button"
                      key={r.id}
                      className="rest-tl__bar"
                      data-status={r.status}
                      style={place} /* slop-allow: inline-style место и длина полосы из времени брони */
                      aria-label={`${name}, ${clock(r.startsAt)}–${clock(r.endsAt)}, ${pluralRu(r.partySize, ['гость', 'гостя', 'гостей'])}, ${foodStatus[r.status].label}`}
                      onClick={() => onOpen(r)}
                    >
                      <span>{name}</span>
                    </button>
                  );
                })}
              {nowMinutes !== null && nowMinutes >= fromHour * 60 && nowMinutes < toHour * 60 && (
                <i
                  className="rest-tl__now"
                  style={{ left: pct(nowMinutes) }} /* slop-allow: inline-style линия текущего времени */
                  aria-hidden="true"
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
