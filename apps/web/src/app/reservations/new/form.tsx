'use client';
import { useActionState, useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Field, Grid, Input, Select, Textarea } from '../../../components/ui';
import { AUTO_UNIT, type PlacementPrefill } from '../../../lib/booking-link';
import { displayDate } from '../../../lib/display-date';
import { nightsBetween, pluralRu } from '../../../lib/plural';
import {
  createReservationAction,
  findGuestsByPhoneAction,
  type ActionResult,
  type BookingGuest,
} from '../actions';
import { BookingPrice } from './price';
import { DateInput } from '../../../components/date-field';
import type { StayAvailability } from '../../../lib/api';
import { checkBookingAvailability } from './availability';
import { CHANNELS, SOURCES } from '../sources';

export function NewReservationForm(props: {
  /** Размещения из адресной строки: «Свободные места» (AV3, ADR-110) или ячейка из шахматки */
  prefill: PlacementPrefill[];
  today: string;
  initialAvailability: StayAvailability | null;
  arrival: string;
  departure: string;
  categories: Array<{
    code: string;
    name: string;
    capacityAdults: number;
    availableUnitCodes: string[];
  }>;
  ratePlans: Array<{ code: string; name: string; currency: string }>;
  /** ADR-072: `pseudonymized` — база не в Казахстане, имя и контакты гостя форма не спрашивает */
  piiStorage: 'real' | 'pseudonymized';
  /** G6 (ТЗ «Гости v2» §33): гость из карточки (`?guest=`) — бронь на него, без нового гостя */
  guest: BookingGuest | null;
}) {
  const [arrival, setArrival] = useState(props.arrival);
  const [departure, setDeparture] = useState(props.departure);
  const [availability, setAvailability] = useState(props.initialAvailability);
  const [availabilityError, setAvailabilityError] = useState('');
  const [checking, setChecking] = useState(false);
  const [retry, setRetry] = useState(0);
  const validDates =
    /^\d{4}-\d{2}-\d{2}$/.test(arrival) &&
    /^\d{4}-\d{2}-\d{2}$/.test(departure) &&
    departure > arrival;
  const fresh =
    validDates &&
    availability?.arrivalDate === arrival &&
    availability?.departureDate === departure;
  useEffect(() => {
    if (!validDates) return;
    let active = true;
    setChecking(true);
    setAvailabilityError('');
    const timer = window.setTimeout(() => {
      void checkBookingAvailability(arrival, departure).then((result) => {
        if (!active) return;
        setChecking(false);
        setAvailability(result.availability);
        setAvailabilityError(result.error);
      });
    }, 200);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [arrival, departure, validDates, retry]);
  const categories = props.categories.map((category) => ({
    ...category,
    availableUnitCodes: fresh
      ? (availability.byCategory[category.code]?.availableUnitCodes ?? [])
      : [],
  }));
  function chooseArrival(value: string) {
    const nights = Math.max(1, nightsBetween(arrival, departure) || 1);
    setArrival(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) setDeparture(plusDays(value, nights));
  }
  const [state, action, pending] = useActionState<ActionResult, FormData>(createReservationAction, {
    error: null,
  });
  // отказ (например, койку заняли из соседнего окна) не должен стирать введённое
  const kept = state.values ?? {};
  // выбранный гость живёт вне формы с ключом попытки: отказ API не сбрасывает выбор
  const [picked, setPicked] = useState<BookingGuest | null>(props.guest);
  const [phone, setPhone] = useState('');
  const [placementIds, setPlacementIds] = useState(() =>
    props.prefill.length ? props.prefill.map((_, index) => String(index)) : ['0'],
  );
  const nextPlacement = useRef(Math.max(1, props.prefill.length));
  const unavailable = props.prefill
    .map((p) => p.unit)
    .filter(
      (unit) =>
        unit && unit !== AUTO_UNIT && !categories.some((c) => c.availableUnitCodes.includes(unit)),
    );
  // Резюме читается из полей формы; цену и доступность проверяет сервер.
  const formRef = useRef<HTMLFormElement>(null);
  const [snapshot, setSnapshot] = useState<Record<string, string>>({});
  const refresh = useCallback(() => {
    const el = formRef.current;
    if (!el) return;
    const next: Record<string, string> = {};
    for (const [name, value] of new FormData(el)) if (typeof value === 'string') next[name] = value;
    setSnapshot(next);
  }, []);
  useEffect(refresh, [refresh, state.attempt, placementIds, availability, arrival, departure]);
  const facts = summarize({ ...props, arrival, departure }, placementIds, snapshot, picked);
  return (
    <form
      // React сбрасывает поля формы после server action, и управляемый select остаётся на первом
      // пункте, пока его состояние не изменилось. Новый ключ на попытку отрисовывает поля заново.
      key={state.attempt ?? 0}
      ref={formRef}
      action={action}
      // второй проход после отрисовки: смена категории перерисовывает список ячеек уже после события
      onChange={() => {
        refresh();
        window.setTimeout(refresh, 0);
      }}
      data-testid="new-reservation-form"
      className="panel panel--lg booking-form"
    >
      <section className="booking-create__dates" aria-label="Даты проживания">
        <div className="booking-create__date-fields">
          <Field label="Заезд">
            <DateInput
              name="arrivalDate"
              value={arrival}
              onChange={(e) => chooseArrival(e.target.value)}
              required
            />
          </Field>
          <Field label="Выезд">
            <DateInput
              name="departureDate"
              rangeFromName="arrivalDate"
              value={departure}
              onChange={(e) => setDeparture(e.target.value)}
              required
            />
          </Field>
        </div>
        <div className="booking-create__quick" aria-label="Быстрые даты">
          <Button
            type="button"
            size="sm"
            tone="secondary"
            onClick={() => chooseArrival(props.today)}
          >
            Сегодня
          </Button>
          <Button
            type="button"
            size="sm"
            tone="secondary"
            onClick={() => chooseArrival(plusDays(props.today, 1))}
          >
            Завтра
          </Button>
          {[1, 2, 3, 7].map((n) => (
            <Button
              key={n}
              type="button"
              size="sm"
              tone="secondary"
              disabled={!/^\d{4}-\d{2}-\d{2}$/.test(arrival)}
              aria-pressed={nightsBetween(arrival, departure) === n}
              onClick={() => setDeparture(plusDays(arrival, n))}
            >
              {pluralRu(n, ['ночь', 'ночи', 'ночей'])}
            </Button>
          ))}
        </div>
        <p data-testid="availability" role="status" className="booking-dates__availability">
          {!validDates
            ? 'Выезд должен быть позже заезда.'
            : checking || !fresh
              ? availabilityError || 'Проверяем свободные места…'
              : `${pluralRu(availability.nights, ['ночь', 'ночи', 'ночей'])} · свободно ${availability.total.available} из ${availability.total.units}`}
        </p>
        {availabilityError && (
          <Button type="button" tone="secondary" size="sm" onClick={() => setRetry((n) => n + 1)}>
            Повторить проверку
          </Button>
        )}
      </section>
      <div className="form-section-title">
        <span>02</span>
        <div>
          <h2>Размещение</h2>
        </div>
      </div>
      {props.categories.length === 0 && (
        <Alert tone="warning">Сначала добавьте категории и номера в разделе «Номерной фонд».</Alert>
      )}
      {props.ratePlans.length === 0 && (
        <Alert tone="warning">Сначала добавьте тариф в разделе «Тарифы и цены».</Alert>
      )}
      {unavailable.length > 0 && (
        <Alert tone="warning">
          {unavailable.length === 1
            ? `Выбранная ячейка ${unavailable[0]} недоступна`
            : `Выбранные ячейки ${unavailable.join(', ')} недоступны`}{' '}
          на этот период. Выберите другое размещение.
        </Alert>
      )}
      <input type="hidden" name="placementIds" value={placementIds.join(',')} />
      {placementIds.map((id, index) => (
        <fieldset key={id} className="placement-fields" data-testid="placement-fields">
          <legend>Размещение {index + 1}</legend>
          <PlacementFields
            id={id}
            kept={kept}
            categories={categories}
            ratePlans={props.ratePlans}
            initial={props.prefill[Number(id)]}
          />
          {id !== '0' && (
            <Button
              type="button"
              tone="secondary"
              size="sm"
              onClick={() => setPlacementIds((ids) => ids.filter((item) => item !== id))}
            >
              Удалить размещение {index + 1}
            </Button>
          )}
        </fieldset>
      ))}
      {(picked || props.piiStorage === 'real') && (
        <h2 className="booking-create__guest-title">Гость</h2>
      )}
      {picked ? (
        <PickedGuest
          guest={picked}
          onChange={() => {
            // поля нового гостя появятся пустыми — подсказка по прежнему телефону не нужна
            setPhone('');
            setPicked(null);
            // гость из карточки пришёл адресом: без `guest` обновление страницы не вернёт его.
            // Переход здесь не нужен — перехват открыл бы вторую форму панелью поверх этой
            const url = new URL(window.location.href);
            if (url.searchParams.has('guest')) {
              url.searchParams.delete('guest');
              window.history.replaceState(null, '', `${url.pathname}${url.search}`);
            }
          }}
        />
      ) : props.piiStorage === 'real' ? (
        <>
          <Grid>
            <Field label="Имя *">
              <Input name="firstName" required defaultValue={kept['firstName'] ?? ''} />
            </Field>
            <Field label="Фамилия *">
              <Input name="lastName" required defaultValue={kept['lastName'] ?? ''} />
            </Field>
            <Field label="Отчество">
              <Input name="middleName" defaultValue={kept['middleName'] ?? ''} />
            </Field>
            <Field label="Email">
              <Input type="email" name="email" defaultValue={kept['email'] ?? ''} />
            </Field>
            <Field label="Телефон">
              <Input
                type="tel"
                name="phone"
                defaultValue={kept['phone'] ?? ''}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
          </Grid>
          <GuestMatches phone={phone} onPick={setPicked} />
        </>
      ) : null}
      <details className="booking-create__extras">
        <summary>Дополнительно</summary>
        <div className="booking-create__extra-fields">
          <Grid>
            <Field label="Источник *">
              <Select name="source" required defaultValue={kept['source'] ?? SOURCES[0]![0]}>
                <option value="" disabled>
                  Выберите источник
                </option>
                {SOURCES.map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
            {snapshot['source'] === 'OTA' && (
              <>
                <Field label="Канал *">
                  <Select name="channel" required defaultValue={kept['channel'] ?? ''}>
                    <option value="" disabled>
                      Выберите канал
                    </option>
                    {CHANNELS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Номер брони в канале *">
                  <Input
                    name="externalId"
                    required
                    defaultValue={kept['externalId'] ?? ''}
                    placeholder="как в экстранете"
                    autoComplete="off"
                  />
                </Field>
              </>
            )}
          </Grid>
          {snapshot['source'] === 'OTA' && (
            <p className="hint" data-testid="channel-number-hint">
              Номер брони берётся из экстранета канала. По нему WETOP узнает эту бронь, когда канал
              подключат к менеджеру каналов, и не создаст вторую.
            </p>
          )}
          <Button
            type="button"
            tone="secondary"
            disabled={pending || placementIds.length >= 88}
            onClick={() => {
              const id = String(nextPlacement.current++);
              setPlacementIds((ids) => [...ids, id]);
            }}
          >
            + Добавить размещение
          </Button>
          <Field label="Промокод">
            <Input
              name="promoCode"
              autoComplete="off"
              defaultValue={kept['promoCode'] ?? ''}
              placeholder="Если гость назвал код"
            />
          </Field>
          <Field label="Заметки">
            <Textarea
              name="notes"
              rows={3}
              defaultValue={kept['notes'] ?? ''}
              placeholder={
                props.piiStorage === 'real'
                  ? 'Пожелания гостя и информация для смены'
                  : 'Пожелания для смены (без персональных данных)'
              }
            />
          </Field>
        </div>
      </details>
      {state.error && <Alert style={{ fontSize: 'var(--text-md)' }}>{state.error}</Alert>}
      <details className="booking-create__review">
        <summary>Проверить детали брони</summary>
        <BookingSummary facts={facts} />
      </details>
      {/* Липкий подвал: одна строка сути и кнопка — невысокий, чтобы на телефоне при непрокрученной
          форме не уходить под нижнюю навигацию; полное резюме — блоком выше */}
      <div className="booking-footer">
        <p className="booking-footer__digest" data-testid="booking-digest">
          {[facts.datesText, ...facts.placements].join('; ')}
        </p>
        <div className="booking-footer__actions">
          <BookingPrice
            arrival={arrival}
            departure={departure}
            snapshot={snapshot}
            single={placementIds.length === 1}
          />
          <Button
            type="submit"
            disabled={
              pending ||
              checking ||
              !fresh ||
              Boolean(availabilityError) ||
              props.categories.length === 0 ||
              props.ratePlans.length === 0
            }
          >
            {pending ? 'Сохраняю…' : 'Создать бронь'}
          </Button>
        </div>
      </div>
    </form>
  );
}

/** Что именно создастся: даты, размещения, источник, гость. Без цен (их считает сервер). */
function summarize(
  props: {
    arrival: string;
    departure: string;
    categories: Array<{ code: string; name: string }>;
    piiStorage: 'real' | 'pseudonymized';
  },
  placementIds: string[],
  snapshot: Record<string, string>,
  picked: BookingGuest | null,
) {
  const dash = '—';
  const nights = nightsBetween(props.arrival, props.departure);
  const placements = placementIds.map((id) => {
    const field = (name: string) => (id === '0' ? name : `item.${id}.${name}`);
    const category = props.categories.find(
      (c) => c.code === snapshot[field('accommodationTypeCode')],
    );
    const quantity = Math.max(1, Number(snapshot[field('quantity')] ?? '1') || 1);
    const adults = Math.max(1, Number(snapshot[field('adults')] ?? '1') || 1);
    const unit = snapshot[field('unitCode')];
    const where =
      quantity > 1
        ? `${pluralRu(quantity, ['место', 'места', 'мест'])}, ячейки назначит система`
        : unit === AUTO_UNIT
          ? 'ячейку назначит система'
          : unit
            ? `ячейка ${unit}`
            : 'ячейка назначается позже';
    return `${category?.name ?? dash}, ${where}, ${pluralRu(adults, ['гость', 'гостя', 'гостей'])}`;
  });
  return {
    nights,
    arrival: props.arrival,
    departure: props.departure,
    datesText:
      nights > 0
        ? `${displayDate(props.arrival)} → ${displayDate(props.departure)}, ${pluralRu(nights, ['ночь', 'ночи', 'ночей'])}`
        : dash,
    placements,
    source: SOURCES.find(([value]) => value === snapshot['source'])?.[1] ?? dash,
    guest: picked
      ? picked.name
      : props.piiStorage === 'real'
        ? [snapshot['lastName'], snapshot['firstName']].filter(Boolean).join(' ').trim() || dash
        : 'Автоматическая карточка',
  };
}

/**
 * Выбранный гость (G6, ТЗ «Гости v2» §33): бронь запишется на него, новый гость не создаётся.
 * Контакты здесь не правятся — форма брони не переписывает карточку гостя молча.
 */
function PickedGuest({ guest, onChange }: { guest: BookingGuest; onChange: () => void }) {
  const facts = [
    guest.phone,
    guest.email,
    pluralRu(guest.visits, ['визит', 'визита', 'визитов']),
  ].filter(Boolean);
  return (
    <div className="booking-guest" data-testid="booking-guest">
      <input type="hidden" name="guestId" value={guest.id} />

      <div className="booking-guest__who">
        <strong>{guest.name}</strong>
        <span className="dir-sub">{facts.join(', ')}</span>
      </div>
      <Button type="button" tone="secondary" size="sm" onClick={onChange}>
        Другой гость
      </Button>
      <p className="hint booking-guest__hint">
        Бронь запишется на этого гостя, нового не появится. Телефон и почту меняют в карточке гостя.
      </p>
    </div>
  );
}

/**
 * ТЗ «Гости v2» §34: набран полный телефон — сначала известные гости с ним. «Выбрать» переключает
 * шаг «Гость» на найденного; не выбрал — бронь заведёт нового гостя, как раньше.
 */
function GuestMatches({ phone, onPick }: { phone: string; onPick: (guest: BookingGuest) => void }) {
  const [matches, setMatches] = useState<BookingGuest[]>([]);
  const digits = phone.replace(/\D/g, '');
  useEffect(() => {
    if (digits.length < 10) {
      setMatches([]);
      return;
    }
    let live = true;
    // пауза, чтобы не спрашивать API на каждую цифру; ответ устаревшего набора отбрасывается
    const timer = window.setTimeout(() => {
      void findGuestsByPhoneAction(digits).then((found) => {
        if (live) setMatches(found);
      });
    }, 350);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [digits]);
  if (matches.length === 0) return null;
  return (
    <div className="booking-matches" data-testid="guest-matches" role="status">
      <b className="booking-matches__title">
        {matches.length === 1 ? 'Найден гость с этим телефоном' : 'Найдены гости с этим телефоном'}
      </b>
      <ul>
        {matches.map((m) => (
          <li key={m.id} data-testid="guest-match">
            <span className="booking-matches__who">
              <strong>{m.name}</strong>
              <span className="dir-sub">{pluralRu(m.visits, ['визит', 'визита', 'визитов'])}</span>
            </span>
            <Button type="button" tone="secondary" size="sm" onClick={() => onPick(m)}>
              Выбрать
            </Button>
          </li>
        ))}
      </ul>
      <p className="hint">Не тот человек — заполните дальше, и бронь заведёт нового гостя.</p>
    </div>
  );
}

function BookingSummary({ facts }: { facts: ReturnType<typeof summarize> }) {
  return (
    <dl className="booking-summary" data-testid="booking-summary">
      <dt>Даты</dt>
      <dd>
        {facts.nights > 0 ? (
          <>
            <time dateTime={facts.arrival}>{displayDate(facts.arrival)}</time> →{' '}
            <time dateTime={facts.departure}>{displayDate(facts.departure)}</time>,{' '}
            {pluralRu(facts.nights, ['ночь', 'ночи', 'ночей'])}
          </>
        ) : (
          '—'
        )}
      </dd>
      <dt>Размещение</dt>
      <dd>
        {facts.placements.map((line, index) => (
          <span key={index} className="booking-summary__line">
            {line}
          </span>
        ))}
      </dd>
      <dt>Источник</dt>
      <dd>{facts.source}</dd>
      <dt>Гость</dt>
      <dd>{facts.guest}</dd>
    </dl>
  );
}

function PlacementFields({
  id,
  kept,
  categories,
  ratePlans,
  initial,
}: {
  id: string;
  kept: Record<string, string>;
  categories: Array<{
    code: string;
    name: string;
    capacityAdults: number;
    availableUnitCodes: string[];
  }>;
  ratePlans: Array<{ code: string; name: string; currency: string }>;
  initial: PlacementPrefill | undefined;
}) {
  const field = (name: string) => (id === '0' ? name : `item.${id}.${name}`);
  const selectedUnit = initial?.unit ?? '';
  const [category, setCategory] = useState(
    kept[field('accommodationTypeCode')] ??
      categories.find((c) => c.code === initial?.category)?.code ??
      categories.find((c) => c.availableUnitCodes.includes(selectedUnit))?.code ??
      categories[0]?.code ??
      '',
  );
  const [quantity, setQuantity] = useState(
    kept[field('quantity')] ?? String(initial?.quantity ?? 1),
  );
  const [chosenUnit, setChosenUnit] = useState(kept[field('unitCode')] ?? selectedUnit);
  const units = categories.find((c) => c.code === category)?.availableUnitCodes ?? [];
  // Предел гостей — вместимость единицы выбранной категории (койка — 1), а не «2» для всех
  const capacity = Math.max(1, categories.find((c) => c.code === category)?.capacityAdults ?? 1);
  const group = Number(quantity) > 1;
  return (
    <Grid>
      <Field label="Категория *">
        <Select
          name={field('accommodationTypeCode')}
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setQuantity('1');
            setChosenUnit('');
          }}
        >
          {categories.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name} (свободно {c.availableUnitCodes.length})
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Тариф *">
        <Select
          name={field('ratePlanCode')}
          required
          defaultValue={
            kept[field('ratePlanCode')] ??
            (ratePlans.some((p) => p.code === initial?.rate) ? initial?.rate : undefined)
          }
        >
          {ratePlans.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name} ({p.currency})
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Гостей в проживании">
        <Input
          type="number"
          name={field('adults')}
          min={1}
          max={capacity}
          defaultValue={kept[field('adults')] ?? initial?.adults ?? 1}
        />
      </Field>
      <Field label="Количество мест">
        <Input
          type="number"
          name={field('quantity')}
          min={1}
          max={Math.max(1, units.length)}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          title={`свободно ${units.length} в категории; при 2 и больше ячейки назначит система`}
        />
      </Field>
      {group ? (
        <div className="field" style={{ justifyContent: 'end' }} data-testid="group-hint">
          {Number(quantity)} проживания на первых свободных ячейках по номеру
          {Number(quantity) > units.length ? ` — свободно только ${units.length}` : ''}
        </div>
      ) : (
        <Field label="Ячейка">
          <Select
            name={field('unitCode')}
            value={chosenUnit === AUTO_UNIT || units.includes(chosenUnit) ? chosenUnit : ''}
            onChange={(e) => setChosenUnit(e.target.value)}
          >
            <option value="">— назначить позже —</option>
            {units.length > 0 && (
              <option value={AUTO_UNIT}>Автоматически — первая свободная</option>
            )}
            {units.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </Field>
      )}
    </Grid>
  );
}

function plusDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return value;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
