'use client';
import { useActionState, useRef, useState } from 'react';
import { Alert, Button, Field, Grid, Input, Select, Textarea } from '../../../components/ui';
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
}) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(createReservationAction, {
    error: null,
  });
  // отказ (например, койку заняли из соседнего окна) не должен стирать введённое
  const kept = state.values ?? {};
  const [placementIds, setPlacementIds] = useState(['0']);
  const nextPlacement = useRef(1);
  return (
    <form
      // React сбрасывает поля формы после server action, и управляемый select остаётся на первом
      // пункте, пока его состояние не изменилось. Новый ключ на попытку отрисовывает поля заново.
      key={state.attempt ?? 0}
      action={action}
      data-testid="new-reservation-form"
      className="panel panel--lg"
    >
      <input type="hidden" name="arrivalDate" value={props.arrival} />
      <input type="hidden" name="departureDate" value={props.departure} />
      <div className="form-section-title">
        <span>01</span>
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
        <span>02</span>
        <div>
          <h2>Гость</h2>
        </div>
      </div>
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
      <Field label="Заметки">
        <Textarea
          name="notes"
          rows={3}
          defaultValue={kept['notes'] ?? ''}
          placeholder="Пожелания гостя и информация для смены"
        />
      </Field>
      {state.error && <Alert style={{ fontSize: 14 }}>{state.error}</Alert>}
      <div className="form-footer">
        <span className="muted small">Цена и доступность проверяются при создании брони.</span>
        <Button type="submit" disabled={pending || !props.canSubmit}>
          {pending ? 'Сохраняю…' : 'Создать бронь'}
        </Button>
      </div>
    </form>
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
