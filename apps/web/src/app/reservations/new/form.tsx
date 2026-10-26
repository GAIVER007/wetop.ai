'use client';
import { useRouter } from 'next/navigation';
import design from './new-reservation.module.css';
import { useActionState, useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Field, Grid, Input, Select, Textarea } from '../../../components/ui';
import { AUTO_UNIT, type PlacementPrefill } from '../../../lib/booking-link';
import { displayDate } from '../../../lib/display-date';
import { nightsBetween } from '../../../lib/plural';
import { countLabel, intlLocale, msg } from '../../../i18n';
import { useLocale, useT } from '../../../i18n/locale-provider';
import {
  createReservationAction,
  findGuestsByPhoneAction,
  type ActionResult,
  type BookingGuest,
} from '../actions';
import { BookingPrice, PriceByNight, useBookingQuote } from './price';
import { DateInput } from '../../../components/date-field';
import type { StayAvailability } from '../../../lib/api';
import { checkBookingAvailability } from './availability';
import { CHANNELS, SOURCES } from '../sources';
import { summarize } from './summary';
import { isStayDate } from '../../../lib/stay-date';
import { phoneFieldValue, phoneOnInput } from '../../../lib/phone';
import { BookingShell, PickButton, PickGroup, PickHeading } from '../../../components/booking-shell';
import { roomChoices, type Housekeeping } from './room-choices';

const NIGHTS: [string, string, string] = [msg('ночь'), 'ночи', msg('ночей')]; // kk-allow: форма склонения
const GUESTS: [string, string, string] = [msg('гость'), 'гостя', msg('гостей')]; // kk-allow: форма склонения
const VISITS: [string, string, string] = [msg('визит'), 'визита', msg('визитов')]; // kk-allow: форма склонения

export function NewReservationForm(props: {
  canMutate: boolean;
  /** Размещения из адресной строки: «Свободные места» (AV3, ADR-110) или ячейка из календаря */
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
  /** уборка номеров из сводки фонда: неубранный номер справа помечен точкой */
  housekeeping: Housekeeping;
}) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const [arrival, setArrival] = useState(props.arrival);
  const [departure, setDeparture] = useState(props.departure);
  const [availability, setAvailability] = useState(props.initialAvailability);
  const [availabilityError, setAvailabilityError] = useState('');
  const [checking, setChecking] = useState(false);
  const [retry, setRetry] = useState(0);
  // Даты, ответ по которым уже на руках: сервер проверил даты из пропсов при рендере формы, или ответил
  // прошлый рейс из браузера. Тот же рейс не повторяется. Ключ ставится по приходу ответа, а не при
  // отправке: иначе возврат к прежним датам (A → B → A) оставлял «Проверяем свободные места…» навсегда
  const lastChecked = useRef(
    props.initialAvailability
      ? `${props.initialAvailability.arrivalDate} ${props.initialAvailability.departureDate} 0`
      : '',
  );
  const arrivalError = isStayDate(arrival) ? '' : t('Введите корректную дату');
  const departureError = !isStayDate(departure)
    ? t('Введите корректную дату')
    : !arrivalError && departure <= arrival
      ? t('Дата выезда должна быть позже даты заезда')
      : '';
  const validDates = !arrivalError && !departureError;
  const fresh =
    validDates &&
    availability?.arrivalDate === arrival &&
    availability?.departureDate === departure;
  useEffect(() => {
    if (!validDates) return;
    const key = `${arrival} ${departure} ${retry}`;
    if (lastChecked.current === key) {
      // проверка промежуточных дат отменена, ответ по этим датам уже есть: ждать нечего
      // (покрывает и повторный показ исходных дат: `lastChecked` заведён с них при монтировании)
      setChecking(false);
      return;
    }
    let active = true;
    setChecking(true);
    setAvailabilityError('');
    const timer = window.setTimeout(() => {
      void checkBookingAvailability(arrival, departure)
        .then((result) => {
          if (!active) return;
          lastChecked.current = result.availability && !result.error ? key : '';
          setChecking(false);
          setAvailability(result.availability);
          setAvailabilityError(result.error && t(result.error));
        })
        .catch(() => {
          if (!active) return;
          lastChecked.current = '';
          setChecking(false);
          setAvailability(null);
          setAvailabilityError(t('Не удалось проверить свободные места.'));
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
    if (isStayDate(value)) setDeparture(plusDays(value, nights));
  }
  const submission = useRef<{ fingerprint: string; key: string } | null>(null);
  const [state, action, pending] = useActionState<ActionResult, FormData>(
    async (previous, fd) => {
      const fingerprint = JSON.stringify(
        [...fd.entries()]
          .filter(([name]) => name !== 'creationKey')
          .sort(([a], [b]) => a.localeCompare(b)),
      );
      if (submission.current?.fingerprint !== fingerprint)
        submission.current = { fingerprint, key: crypto.randomUUID() };
      fd.set('creationKey', submission.current.key);
      return createReservationAction(previous, fd);
    },
    { error: null },
  );
  // отказ (например, койку заняли из соседнего окна) не должен стирать введённое
  const kept = state.values ?? {};
  // выбранный гость живёт вне формы с ключом попытки: отказ API не сбрасывает выбор
  const [picked, setPicked] = useState<BookingGuest | null>(props.guest);
  const [phone, setPhone] = useState('');
  const [placementIds, setPlacementIds] = useState(() =>
    props.prefill.length ? props.prefill.map((_, index) => String(index)) : ['0'],
  );
  const nextPlacement = useRef(Math.max(1, props.prefill.length));
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
  const quote = useBookingQuote(
    arrival,
    departure,
    snapshot,
    placementIds,
    validDates,
    state.attempt ?? 0,
  );
  const unavailable = placementIds.flatMap((id) => {
    const prefix = id === '0' ? '' : `item.${id}.`;
    const unit = snapshot[`${prefix}unitCode`];
    const category = categories.find((c) => c.code === snapshot[`${prefix}accommodationTypeCode`]);
    return fresh && unit && unit !== AUTO_UNIT && !category?.availableUnitCodes.includes(unit)
      ? [unit]
      : [];
  });
  const unavailableSelection = unavailable.length > 0;
  const facts = summarize({ ...props, arrival, departure }, placementIds, snapshot, picked, locale, t);
  // Правая часть окна (решение 23.10.2026, вариант B): свободные номера кнопками по категориям для первого
  // размещения. Нажатие ставит категорию и номер в поля размещения, поля остаются источником для отправки.
  const [pickRequest, setPickRequest] = useState<{ category: string; unit: string; n: number } | null>(
    null,
  );
  useEffect(() => {
    if (pickRequest) window.setTimeout(refresh, 0);
  }, [pickRequest, refresh]);
  const chosenCategory = snapshot['accommodationTypeCode'] ?? '';
  const chosenUnit = snapshot['unitCode'] ?? '';
  const guestsWanted = Math.max(1, Number(snapshot['adults'] ?? 1) || 1);
  const group = placementIds.length > 1 || Number(snapshot['quantity'] ?? 1) > 1;
  const choices = roomChoices(
    categories,
    {
      guests: guestsWanted,
      housekeeping: props.housekeeping,
    },
    locale,
    t,
  );
  const anyDirty = choices.some((c) => c.units.some((u) => u.dirty));
  const pick = (
    <>
      <PickHeading
        title={t('Свободные номера')}
        note={
          !validDates
            ? t('Укажите даты')
            : checking || !fresh
              ? availabilityError || t('Проверяем свободные номера…')
              : `${facts.datesText}, ${countLabel(locale, t, guestsWanted, GUESTS)}`
        }
      />
      {props.categories.length === 0 && (
        <Alert tone="warning">{t('Сначала добавьте категории и номера в разделе «Номерной фонд».')}</Alert>
      )}
      {props.ratePlans.length === 0 && (
        <Alert tone="warning">{t('Сначала задайте цену категории в «Категориях номеров».')}</Alert>
      )}
      {unavailable.length > 0 && (
        <Alert tone="warning">
          {unavailable.length === 1
            ? t('Выбранный номер {unit} недоступен на этот период. Выберите другое размещение.', {
                unit: unavailable[0]!,
              })
            : t('Выбранные номера {units} недоступны на этот период. Выберите другое размещение.', {
                units: unavailable.join(', '),
              })}
        </Alert>
      )}
      {group && (
        <p className="booking-pick__muted" data-testid="room-picker-group">
          {t('Несколько мест или размещений: номера назначит система по порядку, их видно в «Проверить детали брони».')}
        </p>
      )}
      {!group && validDates && (
        <div className="booking-rooms" data-testid="room-picker">
          {choices.map((c) => (
            <PickGroup
              key={c.code}
              testId="room-group"
              title={c.name}
              selected={c.code === chosenCategory}
              facts={
                checking || !fresh
                  ? t('проверяем…')
                  : t('свободно {n}, {why}', { n: c.free, why: c.why })
              }
              unavailable={
                !c.fits ? c.why : fresh && !checking && c.free === 0 ? t('нет свободных') : undefined
              }
            >
              {c.units.map((u) => (
                <PickButton
                  key={u.code}
                  selected={c.code === chosenCategory && u.code === chosenUnit}
                  mark={u.dirty}
                  label={u.dirty ? t('Номер {unit}, ещё не убран', { unit: u.code }) : t('Номер {unit}', { unit: u.code })}
                  disabled={!props.canMutate || pending}
                  onClick={() =>
                    setPickRequest((r) => ({ category: c.code, unit: u.code, n: (r?.n ?? 0) + 1 }))
                  }
                >
                  {u.code}
                </PickButton>
              ))}
              {c.units.length > 0 && (
                <PickButton
                  wide
                  selected={c.code === chosenCategory && chosenUnit === ''}
                  label={t('{category}: назначить номер позже', { category: c.name })}
                  disabled={!props.canMutate || pending}
                  onClick={() =>
                    setPickRequest((r) => ({ category: c.code, unit: '', n: (r?.n ?? 0) + 1 }))
                  }
                >
                  {t('Назначить позже')}
                </PickButton>
              )}
            </PickGroup>
          ))}
          {anyDirty && (
            <p className="booking-pick__legend">
              <span>
                <span className="booking-pick__dot" aria-hidden="true" />
                {t('номер ещё не убран: выбрать можно, при заселении WETOP напомнит')}
              </span>
            </p>
          )}
        </div>
      )}
      <PriceByNight state={quote} />
    </>
  );
  const form = (
    <>
      {(picked || props.piiStorage === 'real') && (
        <h2 className="booking-create__guest-title">{t('Гость')}</h2>
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
          {/* порядок владельца 23.10.2026: сначала имя, затем телефон; отчество и почта в «Дополнительно» */}
          <div className="booking-guest-fields">
            <Field label={t('Имя *')}>
              <Input name="firstName" required defaultValue={kept['firstName'] ?? ''} />
            </Field>
            <Field label={t('Фамилия *')}>
              <Input name="lastName" required defaultValue={kept['lastName'] ?? ''} />
            </Field>
            <Field label={t('Телефон')} className="booking-guest-fields__phone">
              <Input
                type="tel"
                name="phone"
                inputMode="tel"
                defaultValue={phoneFieldValue(kept['phone'])}
                onInput={phoneOnInput}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
          </div>
          <GuestMatches phone={phone} onPick={setPicked} />
        </>
      ) : null}
      <section className="booking-create__dates" aria-label={t('Даты проживания')}>
        <div className="booking-create__date-fields">
          <Field label={t('Заезд')}>
            <DateInput
              name="arrivalDate"
              value={arrival}
              aria-label={t('Заезд')}
              aria-invalid={Boolean(arrivalError)}
              aria-describedby={arrivalError ? 'booking-arrival-error' : undefined}
              onChange={(e) => setArrival(e.target.value)}
              onInput={(e) => setArrival(e.currentTarget.value)}
              onBlur={(e) => setArrival(e.currentTarget.value)}
              required
            />
            {arrivalError && (
              <small id="booking-arrival-error" role="alert">
                {arrivalError}
              </small>
            )}
          </Field>
          <Field label={t('Выезд')}>
            <DateInput
              name="departureDate"
              rangeFromName="arrivalDate"
              value={departure}
              aria-label={t('Выезд')}
              aria-invalid={Boolean(departureError)}
              aria-describedby={departureError ? 'booking-departure-error' : undefined}
              onChange={(e) => setDeparture(e.target.value)}
              onInput={(e) => setDeparture(e.currentTarget.value)}
              onBlur={(e) => setDeparture(e.currentTarget.value)}
              required
            />
            {departureError && (
              <small id="booking-departure-error" role="alert">
                {departureError}
              </small>
            )}
          </Field>
        </div>
        <div className="booking-create__quick" aria-label={t('Быстрые даты')}>
          <Button
            type="button"
            size="sm"
            tone="secondary"
            onClick={() => chooseArrival(props.today)}
          >
            {t('Сегодня')}
          </Button>
          <Button
            type="button"
            size="sm"
            tone="secondary"
            onClick={() => chooseArrival(plusDays(props.today, 1))}
          >
            {t('Завтра')}
          </Button>
          {[1, 2, 3, 7].map((n) => (
            <Button
              key={n}
              type="button"
              size="sm"
              tone="secondary"
              disabled={!isStayDate(arrival)}
              aria-pressed={nightsBetween(arrival, departure) === n}
              onClick={() => setDeparture(plusDays(arrival, n))}
            >
              {countLabel(locale, t, n, NIGHTS)}
            </Button>
          ))}
        </div>
        <p data-testid="availability" role="status" className="booking-dates__availability">
          {!validDates
            ? t('Выезд должен быть позже заезда.')
            : checking || !fresh
              ? availabilityError || t('Проверяем свободные места…')
              : t('{nights}, свободно {available} из {units}', {
                  nights: countLabel(locale, t, availability.nights, NIGHTS),
                  available: availability.total.available,
                  units: availability.total.units,
                })}
        </p>
        {availabilityError && (
          <Button type="button" tone="secondary" size="sm" onClick={() => setRetry((n) => n + 1)}>
            {t('Повторить проверку')}
          </Button>
        )}
      </section>
      <input type="hidden" name="expectedTotalMinor" value={quote.quote?.totalMinor ?? ''} />
      <input type="hidden" name="placementIds" value={placementIds.join(',')} />
      {placementIds.map((id, index) => (
        <fieldset
          key={id}
          className={`placement-fields${placementIds.length === 1 ? ' is-single' : ''}`}
          data-testid="placement-fields"
        >
          <legend className={placementIds.length === 1 ? 'sr-only' : undefined}>
            {t('Размещение {n}', { n: index + 1 })}
          </legend>
          <PlacementFields
            id={id}
            kept={kept}
            categories={categories}
            ratePlans={props.ratePlans}
            initial={props.prefill[Number(id)]}
            request={id === '0' ? pickRequest : null}
            single={placementIds.length === 1}
          />
          {id !== '0' && (
            <Button
              type="button"
              tone="secondary"
              size="sm"
              onClick={() => setPlacementIds((ids) => ids.filter((item) => item !== id))}
            >
              {t('Удалить размещение {n}', { n: index + 1 })}
            </Button>
          )}
        </fieldset>
      ))}
      <details className="booking-create__extras">
        <summary>{t('Дополнительно')}</summary>
        <div className="booking-create__extra-fields">
          <Grid>
            {!picked && props.piiStorage === 'real' && (
              <>
                <Field label={t('Отчество')}>
                  <Input name="middleName" defaultValue={kept['middleName'] ?? ''} />
                </Field>
                <Field label={t('Email')}>
                  <Input type="email" name="email" defaultValue={kept['email'] ?? ''} />
                </Field>
              </>
            )}
            <Field label={t('Источник *')}>
              <Select name="source" required defaultValue={kept['source'] ?? SOURCES[0]![0]}>
                <option value="" disabled>
                  {t('Выберите источник')}
                </option>
                {SOURCES.map(([v, label]) => (
                  <option key={v} value={v}>
                    {t(label)}
                  </option>
                ))}
              </Select>
            </Field>
            {snapshot['source'] === 'OTA' && (
              <>
                <Field label={t('Канал *')}>
                  <Select name="channel" required defaultValue={kept['channel'] ?? ''}>
                    <option value="" disabled>
                      {t('Выберите канал')}
                    </option>
                    {CHANNELS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t('Номер брони в канале *')}>
                  <Input
                    name="externalId"
                    required
                    defaultValue={kept['externalId'] ?? ''}
                    placeholder={t('как в экстранете')}
                    autoComplete="off"
                  />
                </Field>
              </>
            )}
            <Field label={t('Промокод')}>
              <Input
                name="promoCode"
                autoComplete="off"
                defaultValue={kept['promoCode'] ?? ''}
                placeholder={t('Если гость назвал код')}
              />
            </Field>
          </Grid>
          {snapshot['source'] === 'OTA' && (
            <p className="hint" data-testid="channel-number-hint">
              {t('Номер брони берётся из экстранета канала. По нему WETOP узнает эту бронь, когда канал подключат к менеджеру каналов, и не создаст вторую.')}
            </p>
          )}
          <Field label={t('Заметки')}>
            <Textarea
              name="notes"
              rows={2}
              defaultValue={kept['notes'] ?? ''}
              placeholder={
                props.piiStorage === 'real'
                  ? t('Пожелания гостя и информация для смены')
                  : t('Пожелания для смены (без персональных данных)')
              }
            />
          </Field>
          <Button
            type="button"
            tone="secondary"
            disabled={pending || placementIds.length >= 88}
            onClick={() => {
              const id = String(nextPlacement.current++);
              setPlacementIds((ids) => [...ids, id]);
            }}
          >
            {t('+ Добавить размещение')}
          </Button>
        </div>
      </details>
      {state.error && <Alert>{t(state.error)}</Alert>}
      <details className="booking-create__review">
        <summary>{t('Проверить детали брони')}</summary>
        {validDates ? <BookingSummary facts={facts} /> : <p>{t('Проверьте даты проживания')}</p>}
      </details>
    </>
  );
  return (
    <form
      // React сбрасывает поля формы после server action, и управляемый select остаётся на первом
      // пункте, пока его состояние не изменилось. Новый ключ на попытку отрисовывает поля заново.
      key={state.attempt ?? 0}
      ref={formRef}
      action={action}
      onSubmit={(event) => {
        if (!props.canMutate) {
          event.preventDefault();
          return;
        }
        const fields = new FormData(event.currentTarget);
        if (
          pending ||
          !validDates ||
          !quote.ready ||
          unavailableSelection ||
          checking ||
          !fresh ||
          availabilityError ||
          fields.get('arrivalDate') !== arrival ||
          fields.get('departureDate') !== departure ||
          event.currentTarget.querySelector('[aria-invalid="true"]')
        )
          event.preventDefault();
      }}
      // второй проход после отрисовки: смена категории перерисовывает список ячеек уже после события
      onChange={() => {
        refresh();
        window.setTimeout(refresh, 0);
      }}
      data-testid="new-reservation-form"
      className={`panel panel--lg booking-form ${design.form}`}
    >
      <BookingShell
        form={form}
        pick={pick}
        pickLabel={t('Свободные номера')}
        footerClassName="booking-footer"
        footer={
          <>
            <p className="booking-footer__digest" data-testid="booking-digest">
              {validDates
                ? [facts.datesText, ...facts.placements].join('; ')
                : t('Проверьте даты проживания')}
            </p>
            <div className="booking-footer__actions">
              {!validDates ? (
                <span className="booking-create__price">{t('Укажите корректные даты для расчёта')}</span>
              ) : (
                <BookingPrice state={quote} />
              )}
              <div className={design.buttons}>
                <Button
                  type="button"
                  tone="secondary"
                  disabled={pending}
                  onClick={() => router.back()}
                >
                  {t('Отмена')}
                </Button>
                <Button
                  type="submit"
                  disabled={
                    !props.canMutate ||
                    pending ||
                    !quote.ready ||
                    unavailableSelection ||
                    checking ||
                    !fresh ||
                    Boolean(availabilityError) ||
                    props.categories.length === 0 ||
                    props.ratePlans.length === 0
                  }
                >
                  {pending ? t('Сохраняю…') : t('Создать бронь')}
                </Button>
              </div>
            </div>
          </>
        }
      />
    </form>
  );
}

/**
 * Выбранный гость (G6, ТЗ «Гости v2» §33): бронь запишется на него, новый гость не создаётся.
 * Контакты здесь не правятся — форма брони не переписывает карточку гостя молча.
 */
function PickedGuest({ guest, onChange }: { guest: BookingGuest; onChange: () => void }) {
  const t = useT();
  const locale = useLocale();
  const facts = [guest.phone, guest.email, countLabel(locale, t, guest.visits, VISITS)].filter(Boolean);
  return (
    <div className="booking-guest" data-testid="booking-guest">
      <input type="hidden" name="guestId" value={guest.id} />

      <div className="booking-guest__who">
        <strong>{guest.name}</strong>
        <span className="dir-sub">{facts.join(', ')}</span>
      </div>
      <Button type="button" tone="secondary" size="sm" onClick={onChange}>
        {t('Другой гость')}
      </Button>
      <p className="hint booking-guest__hint">
        {t('Бронь запишется на этого гостя, нового не появится. Телефон и почту меняют в карточке гостя.')}
      </p>
    </div>
  );
}

/**
 * ТЗ «Гости v2» §34: набран полный телефон — сначала известные гости с ним. «Выбрать» переключает
 * шаг «Гость» на найденного; не выбрал — бронь заведёт нового гостя, как раньше.
 */
function GuestMatches({ phone, onPick }: { phone: string; onPick: (guest: BookingGuest) => void }) {
  const t = useT();
  const locale = useLocale();
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
        {matches.length === 1 ? t('Найден гость с этим телефоном') : t('Найдены гости с этим телефоном')}
      </b>
      <ul>
        {matches.map((m) => (
          <li key={m.id} data-testid="guest-match">
            <span className="booking-matches__who">
              <strong>{m.name}</strong>
              <span className="dir-sub">{countLabel(locale, t, m.visits, VISITS)}</span>
            </span>
            <Button type="button" tone="secondary" size="sm" onClick={() => onPick(m)}>
              {t('Выбрать')}
            </Button>
          </li>
        ))}
      </ul>
      <p className="hint">{t('Не тот человек — заполните дальше, и бронь заведёт нового гостя.')}</p>
    </div>
  );
}

function BookingSummary({ facts }: { facts: ReturnType<typeof summarize> }) {
  const t = useT();
  const locale = useLocale();
  return (
    <dl className="booking-summary" data-testid="booking-summary">
      <dt>{t('Даты')}</dt>
      <dd>
        {facts.nights > 0 ? (
          <>
            <time dateTime={facts.arrival}>{displayDate(facts.arrival, 'short', intlLocale(locale))}</time> →{' '}
            <time dateTime={facts.departure}>{displayDate(facts.departure, 'short', intlLocale(locale))}</time>,{' '}
            {countLabel(locale, t, facts.nights, NIGHTS)}
          </>
        ) : (
          '—'
        )}
      </dd>
      <dt>{t('Размещение')}</dt>
      <dd>
        {facts.placements.map((line, index) => (
          <span key={index} className="booking-summary__line">
            {line}
          </span>
        ))}
      </dd>
      <dt>{t('Источник')}</dt>
      <dd>{facts.source}</dd>
      <dt>{t('Гость')}</dt>
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
  request = null,
  single = false,
}: {
  /** одно размещение (26.10.2026): категорию и номер ставят кнопки справа, поля остаются для отправки и читалки */
  single?: boolean;
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
  /** выбор кнопкой справа: категория и номер (пустой = назначить позже), `n` различает повторы */
  request?: { category: string; unit: string; n: number } | null;
}) {
  const t = useT();
  const locale = useLocale();
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
  const requestN = request?.n ?? 0;
  useEffect(() => {
    if (!request) return;
    setCategory(request.category);
    setQuantity('1');
    setChosenUnit(request.unit);
    // срабатывает только на новое нажатие справа (`n` растёт с каждым нажатием)
  }, [requestN]);
  // Предел гостей — вместимость единицы выбранной категории (койка — 1), а не «2» для всех
  const capacity = Math.max(1, categories.find((c) => c.code === category)?.capacityAdults ?? 1);
  const group = Number(quantity) > 1;
  // WET-02: поле «Гостей» значит гостей на одно место; при группе API заводит столько проживаний, сколько мест,
  // поэтому подпись и подсказка называют и общее число гостей, чтобы сводка не расходилась с тем, что сохранится
  const [adults, setAdults] = useState(
    Math.max(1, Number(kept[field('adults')] ?? initial?.adults ?? 1) || 1),
  );
  return (
    <Grid>
      <Field label={t('Категория *')} className={single && !group ? 'sr-only' : undefined}>
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
              {t('{category} (свободно {n})', { category: c.name, n: c.availableUnitCodes.length })}
            </option>
          ))}
        </Select>
      </Field>
      {group ? (
        <div className="field" style={{ justifyContent: 'end' }} data-testid="group-hint">
          {t('{n} проживания в первых свободных номерах по порядку', { n: Number(quantity) })}
          {Number(quantity) > units.length ? t(', свободно только {n}', { n: units.length }) : ''}
          {t('; всего {guests}', { guests: countLabel(locale, t, Number(quantity) * adults, GUESTS) })}
        </div>
      ) : (
        <Field label={t('Номер / койка')} className={single ? 'sr-only' : undefined}>
          <Select
            name={field('unitCode')}
            value={chosenUnit}
            aria-invalid={Boolean(
              chosenUnit && chosenUnit !== AUTO_UNIT && !units.includes(chosenUnit),
            )}
            onChange={(e) => setChosenUnit(e.target.value)}
          >
            <option value="">{t('Назначить позже')}</option>
            {chosenUnit && chosenUnit !== AUTO_UNIT && !units.includes(chosenUnit) && (
              <option value={chosenUnit}>{t('{unit}: недоступно на выбранные даты', { unit: chosenUnit })}</option>
            )}
            {units.length > 0 && <option value={AUTO_UNIT}>{t('Первая свободная')}</option>}
            {units.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {/* Тариф (23.10.2026, владелец: «что значит тариф»): при одном тарифе поле не показывается, при
          нескольких называется по сути — цена, по которой считается бронь */}
      {ratePlans.length <= 1 ? (
        <input type="hidden" name={field('ratePlanCode')} value={ratePlans[0]?.code ?? ''} />
      ) : (
        <Field label={t('Цена по тарифу *')}>
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
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label={t('Гостей на место')}>
        <Input
          type="number"
          name={field('adults')}
          min={1}
          max={capacity}
          value={adults}
          onChange={(e) => setAdults(Math.max(1, Number(e.target.value) || 1))}
        />
      </Field>
      <Field label={t('Количество мест')}>
        <Input
          type="number"
          name={field('quantity')}
          min={1}
          max={Math.max(1, units.length)}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          title={t('свободно {n} в категории; при 2 и больше номера назначит система', { n: units.length })}
        />
      </Field>
    </Grid>
  );
}

function plusDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return value;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
