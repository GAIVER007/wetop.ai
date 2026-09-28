'use client';
import { useState } from 'react';
import { MAX_CHESSBOARD_DAYS } from '@pms/domain';
import Link from 'next/link';
import type { InventorySummary, InventoryUnit, StayOffers, reservationsApi } from '../../lib/api';
import { Alert, Button, Field, Input, Select, cx } from '../../components/ui';
import { DateInput } from '../../components/date-field';
import { displayDate } from '../../lib/display-date';
import { formatMoney } from '../../lib/money';
import { pluralRu } from '../../lib/plural';
const plusDays = (date: string, n: number) =>
  new Date(Date.parse(`${date}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
type Availability = Awaited<ReturnType<typeof reservationsApi.availability>>;
export function AvailabilityFinder({
  arrival,
  departure,
  guests,
  offers,
  result,
  error,
  summary,
  units,
  today,
}: {
  today: string;
  arrival: string;
  departure: string;
  guests: number;
  /** Цены «от» (AV2); null — не загрузились или период неверный */
  offers: StayOffers | null;
  result: Availability | null;
  error: string | null;
  summary: InventorySummary;
  units: InventoryUnit[];
}) {
  const [category, setCategory] = useState(''),
    [kind, setKind] = useState(''),
    [showAll, setShowAll] = useState(false);

  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const friday = plusDays(today, (5 - weekday + 7) % 7);
  const rows = summary.byCategory.map((c) => {
    const bed = units.some((u) => u.accommodationTypeCode === c.code && u.kind === 'BED');
    const availability = result?.byCategory[c.code];
    return {
      ...c,
      availability,
      bed,
      // Койкам нужно по месту на гостя; номер вмещает всех гостей целиком — комбинации категорий не предлагаем (ТЗ §2)
      fits: bed ? (availability?.available ?? 0) >= guests : c.capacityAdults >= guests,
    };
  });
  const found = rows.filter((c) => c.fits && (c.availability?.available ?? 0) > 0);
  const freeCount = (bed: boolean) =>
    found.filter((c) => c.bed === bed).reduce((n, c) => n + (c.availability?.available ?? 0), 0);
  const matching = rows.filter(
    (c) =>
      (!category || c.code === category) &&
      (!kind || units.some((u) => u.accommodationTypeCode === c.code && u.kind === kind)),
  );
  const visible = showAll
    ? matching
    : matching.filter((c) => c.fits && (c.availability?.available ?? 0) > 0);
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
        <Field label="Гостей">
          <Input type="number" name="guests" min={1} max={99} defaultValue={guests} required />
        </Field>
        <Button type="submit">Найти</Button>
        <div className="fund-presets">
          {[
            ['Сегодня', today, plusDays(today, 1)],
            ['Завтра', plusDays(today, 1), plusDays(today, 2)],
            ['Выходные', friday, plusDays(friday, 2)],
            ['7 дней', today, plusDays(today, 7)],
          ].map(([label, a, d]) => (
            <Link
              key={label}
              href={`/rooms/availability?arrival=${a}&departure=${d}&guests=${guests}`}
            >
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
                <h2>
                  {found.length
                    ? `Найдено ${pluralRu(found.length, ['вариант', 'варианта', 'вариантов'])}`
                    : 'Ничего не найдено на эти даты'}
                </h2>
                <p className="muted">
                  {displayDate(arrival)} — {displayDate(departure)} ·{' '}
                  {pluralRu(result.nights, ['ночь', 'ночи', 'ночей'])} ·{' '}
                  {pluralRu(guests, ['гость', 'гостя', 'гостей'])}
                </p>
              </div>
              <div className="fund-counts">
                <span>
                  <b>{freeCount(false)}</b> номеров
                </span>
                <span>
                  <b>{freeCount(true)}</b> койко-мест
                </span>
              </div>
            </div>
            {!offers && (
              <p className="fund-row-note muted" role="status">
                Цены не загрузились — места показаны без цен. Обновите страницу.
              </p>
            )}
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
              <div className="seg" role="group" aria-label="Показ категорий">
                {(
                  [
                    [false, 'Только доступные'],
                    [true, 'Все категории'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={showAll === value}
                    className={cx('segment-button', showAll === value && 'is-on')}
                    onClick={() => setShowAll(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {!visible.length ? (
              <section className="fund-empty" role="status">
                <h2>Нет подходящих вариантов</h2>
                <p>
                  Измените даты, число гостей или фильтры. Место должно быть свободно каждую ночь
                  выбранного срока.
                </p>
                <Button
                  tone="secondary"
                  onClick={() => {
                    setCategory('');
                    setKind('');
                    setShowAll(true);
                  }}
                >
                  Показать все категории
                </Button>
              </section>
            ) : (
              <div className="fund-availability">
                {visible.map((c) => {
                  const available = c.availability?.available ?? 0;
                  return (
                    <article key={c.code}>
                      <div className="fund-available-row">
                        <div>
                          <span className="fund-type">
                            {c.bed ? 'Койко-место' : 'Номер целиком'}
                          </span>
                          <h3>{c.name}</h3>
                          <span className="muted">
                            До {c.capacityAdults} {c.capacityAdults === 1 ? 'гостя' : 'гостей'} на{' '}
                            {c.bed ? 'койко-место' : 'номер'}
                          </span>
                        </div>
                        {available > 0 && c.fits && (
                          <OfferPrice
                            offer={offers ? offers.byCategory[c.code] : undefined}
                            currency={offers?.currency}
                            bed={c.bed}
                            guests={guests}
                            nights={result.nights}
                          />
                        )}
                        <div className="fund-available-count">
                          <b>{available}</b>
                          <span>свободно из {c.availability?.units ?? c.units}</span>
                        </div>
                      </div>
                      {!available ? (
                        <p className="fund-row-note muted">Нет мест на весь период</p>
                      ) : (
                        <>
                          {!c.fits && (
                            <p className="fund-row-note muted">
                              {c.bed
                                ? `Свободных коек меньше, чем гостей (${guests})`
                                : `Не вмещает ${pluralRu(guests, ['гостя', 'гостей', 'гостей'])} — до ${c.capacityAdults} на номер`}
                            </p>
                          )}
                          <details>
                            <summary>
                              Показать{' '}
                              {pluralRu(
                                available,
                                c.bed ? ['место', 'места', 'мест'] : ['номер', 'номера', 'номеров'],
                              )}
                            </summary>
                            <div className="fund-members">
                              {c.availability?.availableUnitCodes.map((code) => (
                                <Link key={code} className="fund-book-unit" href={booking(code)}>
                                  {c.bed ? 'Койка' : 'Номер'} {code}
                                  <span>Создать бронь</span>
                                </Link>
                              ))}
                            </div>
                          </details>
                        </>
                      )}
                    </article>
                  );
                })}
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
                Открыть в шахматке
              </Link>
            </div>
          </>
        )
      )}
    </>
  );
}

/**
 * Цена «от» в строке категории (ADR-110, AV2; правило — закрытый Q-204). Итог — весь срок на всех гостей
 * запроса, вторая строка — цена ночи за номер или за одну койку. `undefined` — цены не загрузились
 * (сказано над списком), `null` — ни один тариф не прошёл правило.
 */
function OfferPrice({
  offer,
  currency,
  bed,
  guests,
  nights,
}: {
  offer: StayOffers['byCategory'][string] | undefined;
  currency: string | undefined;
  bed: boolean;
  guests: number;
  nights: number;
}) {
  if (offer === undefined) return null;
  if (offer === null)
    return (
      <div className="fund-price">
        <span className="muted">Нет цены на эти даты</span>
        <Link href="/rates">Тарифы</Link>
      </div>
    );
  const money = (minor: string) => formatMoney(minor, currency);
  const plans =
    offer.plans > 1 ? (
      <span className="muted">{pluralRu(offer.plans, ['тариф', 'тарифа', 'тарифов'])}</span>
    ) : null;
  return bed ? (
    <div className="fund-price">
      <b>Итого от {money(offer.totalMinor)}</b>
      <span className="muted">от {money(offer.perNightMinor)} / койка / ночь</span>
      <span className="muted">
        {pluralRu(guests, ['гость', 'гостя', 'гостей'])}, {pluralRu(nights, ['ночь', 'ночи', 'ночей'])}
      </span>
      {plans}
    </div>
  ) : (
    <div className="fund-price">
      <b>от {money(offer.totalMinor)} за проживание</b>
      <span className="muted">от {money(offer.perNightMinor)} / ночь</span>
      {plans}
    </div>
  );
}
