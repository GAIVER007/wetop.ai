'use client';
import { useActionState, useState } from 'react';
import { createReservationAction, type ActionResult } from '../actions';

const SOURCES: Array<[string, string]> = [
  ['DESK', 'стойка'],
  ['PHONE', 'телефон'],
  ['WHATSAPP', 'WhatsApp'],
  ['WALK_IN', 'с улицы'],
  ['INSTAGRAM', 'Instagram'],
  ['WEBSITE', 'сайт'],
  ['OTA', 'OTA (вручную)'],
];

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
  return (
    <form
      // React сбрасывает поля формы после server action, и управляемый select остаётся на первом
      // пункте, пока его состояние не изменилось. Новый ключ на попытку отрисовывает поля заново.
      key={state.attempt ?? 0}
      action={action}
      data-testid="new-reservation-form"
      style={{
        display: 'grid',
        gap: 12,
        background: '#fff',
        border: '1px solid #e3e5e8',
        borderRadius: 8,
        padding: 16,
      }}
    >
      <input type="hidden" name="arrivalDate" value={props.arrival} />
      <input type="hidden" name="departureDate" value={props.departure} />
      <div style={grid}>
        <label style={lbl}>
          Источник *
          <select name="source" required defaultValue={kept['source'] ?? ''} style={inp}>
            <option value="" disabled>
              — выбрать —
            </option>
            {SOURCES.map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label style={lbl}>
          Категория *
          <select
            name="accommodationTypeCode"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={inp}
          >
            {props.categories.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} (свободно {c.availableUnitCodes.length})
              </option>
            ))}
          </select>
        </label>
        <label style={lbl}>
          Тариф *
          <select name="ratePlanCode" required defaultValue={kept['ratePlanCode']} style={inp}>
            {props.ratePlans.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name} ({p.currency})
              </option>
            ))}
          </select>
        </label>
        <label style={lbl}>
          Гостей в проживании
          <input
            type="number"
            name="adults"
            min={1}
            max={2}
            defaultValue={kept['adults'] ?? 1}
            style={inp}
          />
        </label>
        <label style={lbl}>
          Ячейка
          <select name="unitCode" defaultValue={kept['unitCode'] ?? ''} style={inp}>
            <option value="">— назначить позже —</option>
            {units.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div style={grid}>
        <label style={lbl}>
          Имя *
          <input name="firstName" required defaultValue={kept['firstName'] ?? ''} style={inp} />
        </label>
        <label style={lbl}>
          Фамилия *
          <input name="lastName" required defaultValue={kept['lastName'] ?? ''} style={inp} />
        </label>
        <label style={lbl}>
          Телефон
          <input name="phone" defaultValue={kept['phone'] ?? ''} style={inp} />
        </label>
      </div>
      <label style={lbl}>
        Заметки
        <textarea name="notes" rows={2} style={inp} />
      </label>
      {state.error && (
        <div role="alert" style={{ color: '#b91c1c', fontSize: 14 }}>
          {state.error}
        </div>
      )}
      <div>
        <button type="submit" disabled={pending} style={btn}>
          {pending ? 'Сохраняю…' : 'Создать бронь'}
        </button>
      </div>
    </form>
  );
}
const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 12,
};
const lbl: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 12,
  color: '#555',
};
const inp: React.CSSProperties = {
  padding: '6px 8px',
  border: '1px solid #cbd0d6',
  borderRadius: 6,
  fontSize: 14,
};
const btn: React.CSSProperties = {
  padding: '8px 14px',
  border: 0,
  borderRadius: 6,
  background: '#1d4ed8',
  color: '#fff',
  fontSize: 14,
  cursor: 'pointer',
};
