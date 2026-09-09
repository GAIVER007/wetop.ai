'use client';
import { useState, useTransition } from 'react';
import type { RateChangeInput } from '../../lib/api';
import { bulkRatesAction } from './actions';

const DAYS: Array<[string, string]> = [
  ['mo', 'пн'],
  ['tu', 'вт'],
  ['we', 'ср'],
  ['th', 'чт'],
  ['fr', 'пт'],
  ['sa', 'сб'],
  ['su', 'вс'],
];
const TRI: Array<[string, string]> = [
  ['', 'не менять'],
  ['true', 'да'],
  ['false', 'нет'],
];

/** Список изменений копится в браузере и уходит одним запросом: одна транзакция, одно сообщение в канал. */
export function BulkEditor(props: {
  categories: Array<{ code: string; name: string; capacityAdults: number }>;
  ratePlans: Array<{ code: string; name: string; currency: string; active: boolean }>;
  defaults: {
    accommodationTypeCode: string;
    ratePlanCode: string;
    dateFrom: string;
    dateTo: string;
  };
}) {
  const [rows, setRows] = useState<RateChangeInput[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  /** Без action-формы: React 19 сбрасывает поля после action асинхронно, и сброс гонится со следующим вводом. */
  const add = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const s = (k: string) => String(fd.get(k) ?? '').trim();
    const tri = (k: string) => (s(k) === '' ? undefined : s(k) === 'true');
    const num = (k: string) => (s(k) === '' ? undefined : Number(s(k)));
    const days = DAYS.map(([d]) => d).filter((d) => fd.get(`day-${d}`) === 'on');
    const row: RateChangeInput = {
      accommodationTypeCode: s('accommodationTypeCode'),
      ratePlanCode: s('ratePlanCode'),
      dateFrom: s('dateFrom'),
      dateTo: s('dateTo'),
      ...(days.length && days.length < 7 ? { days } : {}),
      ...(s('price') ? { price: s('price') } : {}),
      ...(num('occupancy') !== undefined ? { occupancy: num('occupancy') } : {}),
      ...(num('minStay') !== undefined ? { minStay: num('minStay') } : {}),
      ...(num('maxStay') !== undefined ? { maxStay: num('maxStay') } : {}),
      ...(tri('stopSell') !== undefined ? { stopSell: tri('stopSell') } : {}),
      ...(tri('closedToArrival') !== undefined ? { closedToArrival: tri('closedToArrival') } : {}),
      ...(tri('closedToDeparture') !== undefined
        ? { closedToDeparture: tri('closedToDeparture') }
        : {}),
    };
    setRows((r) => [...r, row]);
    setDone(null);
    // Категория, тариф и даты остаются для следующей строки; значения — очищаются
    for (const n of ['price', 'occupancy', 'minStay', 'maxStay'])
      (form.elements.namedItem(n) as HTMLInputElement).value = '';
    for (const n of ['stopSell', 'closedToArrival', 'closedToDeparture'])
      (form.elements.namedItem(n) as HTMLSelectElement).value = '';
  };
  const submit = () =>
    start(async () => {
      setError(null);
      const res = await bulkRatesAction(rows);
      if (res.error) setError(res.error);
      else {
        setDone(`Сохранено изменений: ${res.applied}. Ушло в очередь каналов одним сообщением.`);
        setRows([]);
      }
    });
  const name = (code: string, list: Array<{ code: string; name: string }>) =>
    list.find((x) => x.code === code)?.name ?? code;
  return (
    <section
      data-testid="bulk-editor"
      style={{
        background: '#fff',
        border: '1px solid #e3e5e8',
        borderRadius: 8,
        padding: 14,
        display: 'grid',
        gap: 10,
      }}
    >
      <b style={{ fontSize: 15 }}>Массовое изменение</b>
      <form onSubmit={add} style={{ display: 'grid', gap: 8 }}>
        <div style={grid}>
          <label style={lbl}>
            Категория
            <select
              name="accommodationTypeCode"
              defaultValue={props.defaults.accommodationTypeCode}
              style={inp}
            >
              {props.categories.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label style={lbl}>
            Тариф
            <select name="ratePlanCode" defaultValue={props.defaults.ratePlanCode} style={inp}>
              {props.ratePlans.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label style={lbl}>
            С даты
            <input
              type="date"
              name="dateFrom"
              defaultValue={props.defaults.dateFrom}
              required
              style={inp}
            />
          </label>
          <label style={lbl}>
            По дату
            <input
              type="date"
              name="dateTo"
              defaultValue={props.defaults.dateTo}
              required
              style={inp}
            />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12, color: '#555' }}>
          дни:
          {DAYS.map(([d, t]) => (
            <label key={d} style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
              <input type="checkbox" name={`day-${d}`} defaultChecked /> {t}
            </label>
          ))}
        </div>
        <div style={grid}>
          <label style={lbl}>
            Цена за ночь
            <input name="price" placeholder="напр. 15400" inputMode="decimal" style={inp} />
          </label>
          <label style={lbl}>
            Гостей (occupancy)
            <input name="occupancy" type="number" min={1} max={2} placeholder="все" style={inp} />
          </label>
          <label style={lbl}>
            Min stay
            <input name="minStay" type="number" min={0} style={inp} />
          </label>
          <label style={lbl}>
            Max stay
            <input name="maxStay" type="number" min={0} style={inp} />
          </label>
          {(
            [
              ['stopSell', 'Stop sell'],
              ['closedToArrival', 'Закрыт заезд (CTA)'],
              ['closedToDeparture', 'Закрыт выезд (CTD)'],
            ] as const
          ).map(([k, t]) => (
            <label key={k} style={lbl}>
              {t}
              <select name={k} defaultValue="" style={inp}>
                {TRI.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div>
          <button type="submit" style={btnSecondary}>
            + Добавить в список
          </button>
        </div>
      </form>
      {rows.length > 0 && (
        <ul
          data-testid="pending-changes"
          style={{ margin: 0, paddingLeft: 18, fontSize: 13, display: 'grid', gap: 4 }}
        >
          {rows.map((r, i) => (
            <li key={i}>
              {name(r.accommodationTypeCode, props.categories)} ·{' '}
              {name(r.ratePlanCode, props.ratePlans)} · {r.dateFrom}
              {r.dateTo !== r.dateFrom ? ` → ${r.dateTo}` : ''}
              {r.days ? ` (${r.days.join(',')})` : ''}
              {r.price ? ` · цена ${r.price}` : ''}
              {r.occupancy ? ` (${r.occupancy} гост.)` : ''}
              {r.minStay !== undefined ? ` · min ${r.minStay}` : ''}
              {r.maxStay !== undefined ? ` · max ${r.maxStay}` : ''}
              {r.stopSell !== undefined ? ` · stop sell ${r.stopSell ? 'да' : 'нет'}` : ''}
              {r.closedToArrival !== undefined ? ` · CTA ${r.closedToArrival ? 'да' : 'нет'}` : ''}
              {r.closedToDeparture !== undefined
                ? ` · CTD ${r.closedToDeparture ? 'да' : 'нет'}`
                : ''}{' '}
              <button
                type="button"
                onClick={() => setRows((x) => x.filter((_, j) => j !== i))}
                style={{ border: 0, background: 'none', color: '#b91c1c', cursor: 'pointer' }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button
          type="button"
          data-testid="apply-changes"
          onClick={submit}
          disabled={pending || rows.length === 0}
          style={btn}
        >
          {pending ? 'Сохраняю…' : `Сохранить (${rows.length})`}
        </button>
        {error && (
          <span role="alert" style={{ color: '#b91c1c', fontSize: 13 }}>
            {error}
          </span>
        )}
        {done && (
          <span data-testid="bulk-done" style={{ color: '#166534', fontSize: 13 }}>
            {done}
          </span>
        )}
      </div>
    </section>
  );
}
const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: 8,
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
const btnSecondary: React.CSSProperties = {
  padding: '7px 12px',
  border: '1px solid #cbd0d6',
  borderRadius: 6,
  background: '#fff',
  cursor: 'pointer',
};
