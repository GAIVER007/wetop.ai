'use client';
import { useState } from 'react';
import { MAX_CHESSBOARD_DAYS } from '@pms/domain';
import Link from 'next/link';
import type { InventorySummary, InventoryUnit, reservationsApi } from '../../lib/api';
import { Alert, Button, Field, Select } from '../../components/ui';
import { DateInput } from '../../components/date-field';
import { displayDate } from '../../lib/display-date';
import { pluralRu } from '../../lib/plural';
const plusDays = (date: string, n: number) =>
  new Date(Date.parse(`${date}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
type Availability = Awaited<ReturnType<typeof reservationsApi.availability>>;
export function AvailabilityFinder({
  arrival,
  departure,
  result,
  error,
  summary,
  units,
  today,
}: {
  today: string;
  arrival: string;
  departure: string;
  result: Availability | null;
  error: string | null;
  summary: InventorySummary;
  units: InventoryUnit[];
}) {
  const [category, setCategory] = useState(''),
    [kind, setKind] = useState(''),
    [onlyFree, setOnlyFree] = useState(true);

  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const friday = plusDays(today, (5 - weekday + 7) % 7);
  const rows = summary.byCategory
    .filter(
      (c) =>
        (!category || c.code === category) &&
        (!kind || units.some((u) => u.accommodationTypeCode === c.code && u.kind === kind)),
    )
    .map((c) => ({
      ...c,
      availability: result?.byCategory[c.code],
      bed: units.some((u) => u.accommodationTypeCode === c.code && u.kind === 'BED'),
    }));
  const visible = rows.filter((c) => !onlyFree || (c.availability?.available ?? 0) > 0);
  const freeCodes = new Set(
    Object.values(result?.byCategory ?? {}).flatMap((c) => c.availableUnitCodes),
  );
  const freeUnits = units.filter((u) => freeCodes.has(u.code));
  const booking = (unit: string) =>
    `/reservations/new?${new URLSearchParams({ arrival, departure, unit })}`;
  return (
    <>
      <form className="fund-search" method="get">
        <Field label="Заезд">
          <DateInput name="arrival" defaultValue={arrival} required />
        </Field>
        <Field label="Выезд">
          <DateInput
            name="departure"
            rangeFromName="arrival"
            defaultValue={departure}
            max={
              /^\d{4}-\d{2}-\d{2}$/.test(arrival) && Number.isFinite(Date.parse(arrival))
                ? plusDays(arrival, MAX_CHESSBOARD_DAYS)
                : undefined
            }
            required
          />
        </Field>
        <Button type="submit">Найти размещение</Button>
        <div className="fund-presets">
          {[
            ['Сегодня', today, plusDays(today, 1)],
            ['Завтра', plusDays(today, 1), plusDays(today, 2)],
            ['Выходные', friday, plusDays(friday, 2)],
            ['Неделя', today, plusDays(today, 7)],
          ].map(([label, a, d]) => (
            <Link key={label} href={`/rooms/availability?arrival=${a}&departure=${d}`}>
              {label}
            </Link>
          ))}
        </div>
      </form>
      {error ? (
        <Alert boxed>{error}</Alert>
      ) : (
        result && (
          <>
            <div className="fund-result-heading">
              <div>
                <h2>Свободно на весь срок</h2>
                <p className="muted">
                  {displayDate(arrival)} — {displayDate(departure)} ·{' '}
                  {pluralRu(result.nights, ['ночь', 'ночи', 'ночей'])}
                </p>
              </div>
              <div className="fund-counts">
                <span>
                  <b>{freeUnits.filter((u) => u.kind === 'ROOM').length}</b> номеров
                </span>
                <span>
                  <b>{freeUnits.filter((u) => u.kind === 'BED').length}</b> койко-мест
                </span>
              </div>
            </div>
            <div className="fund-toolbar">
              <Select
                aria-label="Категория"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Все категории</option>
                {summary.byCategory.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Select
                aria-label="Тип размещения"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                <option value="">Номера и койки</option>
                <option value="ROOM">Номера</option>
                <option value="BED">Койко-места</option>
              </Select>
              <label className="fund-checkbox">
                <input
                  type="checkbox"
                  checked={onlyFree}
                  onChange={(e) => setOnlyFree(e.target.checked)}
                />{' '}
                Только свободные
              </label>
            </div>
            {!visible.length ? (
              <section className="fund-empty" role="status">
                <h2>Нет подходящих вариантов</h2>
                <p>
                  Измените даты или фильтры. Свободное место должно быть доступно каждую ночь
                  выбранного срока.
                </p>
                <Button
                  tone="secondary"
                  onClick={() => {
                    setCategory('');
                    setKind('');
                    setOnlyFree(false);
                  }}
                >
                  Показать все категории
                </Button>
              </section>
            ) : (
              <div className="fund-availability">
                {visible.map((c) => (
                  <article key={c.code}>
                    <div className="fund-available-row">
                      <div>
                        <span className="fund-type">{c.bed ? 'Койко-место' : 'Номер целиком'}</span>
                        <h3>{c.name}</h3>
                        <span className="muted">
                          До {c.capacityAdults} {c.capacityAdults === 1 ? 'гостя' : 'гостей'} на{' '}
                          {c.bed ? 'койко-место' : 'номер'}
                        </span>
                      </div>
                      <div className="fund-available-count">
                        <b>{c.availability?.available ?? 0}</b>
                        <span>свободно из {c.availability?.units ?? c.units}</span>
                      </div>
                    </div>
                    <details>
                      <summary>
                        {(c.availability?.available ?? 0) > 0
                          ? 'Выбрать номер / койку'
                          : 'Нет свободных мест'}{' '}
                        · {c.availability?.available ?? 0}
                      </summary>
                      <div className="fund-members">
                        {c.availability?.availableUnitCodes.map((code) => (
                          <Link key={code} className="fund-book-unit" href={booking(code)}>
                            {c.bed ? 'Койка' : 'Номер'} {code}
                            <span>Создать бронь →</span>
                          </Link>
                        ))}
                      </div>
                    </details>
                  </article>
                ))}
              </div>
            )}
            <div className="fund-footer">
              <span className="muted">
                Выезд не входит в срок. При сохранении брони доступность проверяется повторно.
              </span>
              <Link
                className="btn btn--secondary"
                href={`/chessboard?${new URLSearchParams({ from: arrival, to: plusDays(departure, -1), ...(category ? { category } : {}) })}`}
              >
                В шахматке →
              </Link>
            </div>
          </>
        )
      )}
    </>
  );
}
