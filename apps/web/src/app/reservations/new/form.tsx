'use client';
import { useActionState, useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Field,
  Grid,
  Input,
  Notice,
  Select,
  Textarea,
} from '../../../components/ui';
import { displayDate } from '../../../lib/display-date';
import { nightsBetween, pluralRu } from '../../../lib/plural';
import { createReservationAction, type ActionResult } from '../actions';
import { SOURCES } from '../sources';

export function NewReservationForm(props: {
  selectedUnit: string;
  canSubmit: boolean;
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
}) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(createReservationAction, {
    error: null,
  });
  // отказ (например, койку заняли из соседнего окна) не должен стирать введённое
  const kept = state.values ?? {};
  const [placementIds, setPlacementIds] = useState(['0']);
  const nextPlacement = useRef(1);
  // Резюме выбора (B2): читается из самих полей формы, без второго источника правды и без цен —
  // цену и доступность считает сервер при создании (правило «нет клиентских финансовых расчётов»)
  const formRef = useRef<HTMLFormElement>(null);
  const [snapshot, setSnapshot] = useState<Record<string, string>>({});
  const refresh = useCallback(() => {
    const el = formRef.current;
    if (!el) return;
    const next: Record<string, string> = {};
    for (const [name, value] of new FormData(el)) if (typeof value === 'string') next[name] = value;
    setSnapshot(next);
  }, []);
  useEffect(refresh, [refresh, state.attempt, placementIds]);
  const facts = summarize(props, placementIds, snapshot);
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
      <input type="hidden" name="arrivalDate" value={props.arrival} />
      <input type="hidden" name="departureDate" value={props.departure} />
      <div className="form-section-title">
        <span>02</span>
        <div>
          <h2>Размещение</h2>
        </div>
      </div>
      {props.selectedUnit &&
        !props.categories.some((c) => c.availableUnitCodes.includes(props.selectedUnit)) && (
          <Alert tone="warning">
            Выбранная ячейка {props.selectedUnit} недоступна на этот период. Выберите другое
            размещение.
          </Alert>
        )}
      <Grid>
        <Field label="Источник *">
          <Select name="source" required defaultValue={kept['source'] ?? ''}>
            <option value="" disabled>
              — выбрать —
            </option>
            {SOURCES.map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
      </Grid>
      <input type="hidden" name="placementIds" value={placementIds.join(',')} />
      {placementIds.map((id, index) => (
        <fieldset key={id} className="placement-fields" data-testid="placement-fields">
          <legend>Размещение {index + 1}</legend>
          <PlacementFields
            id={id}
            kept={kept}
            categories={props.categories}
            ratePlans={props.ratePlans}
            selectedUnit={id === '0' ? props.selectedUnit : ''}
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
      <p className="hint">
        Для группы можно добавить разные категории. Система создаст отдельное проживание и счёт на
        каждое место.
      </p>
      <div className="form-section-title">
        <span>03</span>
        <div>
          <h2>Гость</h2>
        </div>
      </div>
      {props.piiStorage === 'real' ? (
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
            <Input type="tel" name="phone" defaultValue={kept['phone'] ?? ''} />
          </Field>
        </Grid>
      ) : (
        <Notice data-testid="guest-pseudonymized">
          Пока база WETOP не в Казахстане, имена, телефоны и документы гостей в ней не хранятся.
          Гость запишется как «Гость Стойка-…». Бронь находите по датам и ячейке, бронь канала — по
          номеру брони в канале.
        </Notice>
      )}
      <Field label="Заметки">
        <Textarea
          name="notes"
          rows={3}
          defaultValue={kept['notes'] ?? ''}
          placeholder={
            props.piiStorage === 'real'
              ? 'Пожелания гостя и информация для смены'
              : 'Пожелания и информация для смены — без имён и телефонов гостя'
          }
        />
      </Field>
      {state.error && <Alert style={{ fontSize: 14 }}>{state.error}</Alert>}
      <BookingSummary facts={facts} />
      {/* Липкий подвал: одна строка сути и кнопка — невысокий, чтобы на телефоне при непрокрученной
          форме не уходить под нижнюю навигацию; полное резюме — блоком выше */}
      <div className="booking-footer">
        <p className="booking-footer__digest" data-testid="booking-digest">
          {[facts.datesText, ...facts.placements].join('; ')}
        </p>
        <div className="booking-footer__actions">
          <span className="muted small">Цена и доступность проверяются при создании брони.</span>
          <Button type="submit" disabled={pending || !props.canSubmit}>
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
    guest:
      props.piiStorage === 'real'
        ? [snapshot['lastName'], snapshot['firstName']].filter(Boolean).join(' ').trim() || dash
        : 'без имени — база не в Казахстане',
  };
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
  selectedUnit,
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
  selectedUnit: string;
}) {
  const field = (name: string) => (id === '0' ? name : `item.${id}.${name}`);
  const [category, setCategory] = useState(
    kept[field('accommodationTypeCode')] ??
      categories.find((c) => c.availableUnitCodes.includes(selectedUnit))?.code ??
      categories[0]?.code ??
      '',
  );
  const [quantity, setQuantity] = useState(kept[field('quantity')] ?? '1');
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
        <Select name={field('ratePlanCode')} required defaultValue={kept[field('ratePlanCode')]}>
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
          defaultValue={kept[field('adults')] ?? 1}
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
            key={category}
            defaultValue={
              kept[field('unitCode')] ?? (units.includes(selectedUnit) ? selectedUnit : '')
            }
          >
            <option value="">— назначить позже —</option>
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
