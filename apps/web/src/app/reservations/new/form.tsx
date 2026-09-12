'use client';
import { useActionState, useState } from 'react';
import { Alert, Button, Field, Grid, Input, Select, Textarea } from '../../../components/ui';
import { createReservationAction, type ActionResult } from '../actions';
import { SOURCES } from '../sources';

export function NewReservationForm(props: {
  arrival: string;
  departure: string;
  categories: Array<{ code: string; name: string; availableUnitCodes: string[] }>;
  ratePlans: Array<{ code: string; name: string; currency: string }>;
}) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(createReservationAction, {
    error: null,
  });
  // отказ (например, койку заняли из соседнего окна) не должен стирать введённое
  const kept = state.values ?? {};
  const [category, setCategory] = useState(
    kept['accommodationTypeCode'] ?? props.categories[0]?.code ?? '',
  );
  // форма может и уцелеть, и смонтироваться заново — категорию возвращаем в обоих случаях
  const [seen, setSeen] = useState(state.values);
  if (state.values !== seen) {
    setSeen(state.values);
    const back = state.values?.['accommodationTypeCode'];
    if (back) setCategory(back);
  }
  const units = props.categories.find((c) => c.code === category)?.availableUnitCodes ?? [];
  // Групповая бронь: при N > 1 конкретная ячейка не выбирается — система назначит первые N свободных по номеру
  const [quantity, setQuantity] = useState(kept['quantity'] ?? '1');
  const group = Number(quantity) > 1;
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
        <Field label="Категория *">
          <Select
            name="accommodationTypeCode"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {props.categories.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} (свободно {c.availableUnitCodes.length})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Тариф *">
          <Select name="ratePlanCode" required defaultValue={kept['ratePlanCode']}>
            {props.ratePlans.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name} ({p.currency})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Гостей в проживании">
          <Input type="number" name="adults" min={1} max={2} defaultValue={kept['adults'] ?? 1} />
        </Field>
        <Field label="Количество мест">
          <Input
            type="number"
            name="quantity"
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
            <Select name="unitCode" defaultValue={kept['unitCode'] ?? ''}>
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
      <Grid>
        <Field label="Имя *">
          <Input name="firstName" required defaultValue={kept['firstName'] ?? ''} />
        </Field>
        <Field label="Фамилия *">
          <Input name="lastName" required defaultValue={kept['lastName'] ?? ''} />
        </Field>
        <Field label="Телефон">
          <Input name="phone" defaultValue={kept['phone'] ?? ''} />
        </Field>
      </Grid>
      <Field label="Заметки">
        <Textarea name="notes" rows={2} />
      </Field>
      {state.error && <Alert style={{ fontSize: 14 }}>{state.error}</Alert>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? 'Сохраняю…' : 'Создать бронь'}
        </Button>
      </div>
    </form>
  );
}
