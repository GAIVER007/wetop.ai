'use client';
import { useState, useTransition } from 'react';
import type { RateChangeInput } from '../../lib/api';
import { Alert, Button, Field, Grid, Input, Notice, Panel, Row, Select } from '../../components/ui';
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
  // «Гостей» ограничено вместимостью выбранной категории (было жёстко 2)
  const [category, setCategory] = useState(props.defaults.accommodationTypeCode);
  const capacity = props.categories.find((c) => c.code === category)?.capacityAdults ?? 1;
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
        // Обещать отправку в каналы можно только по ответу API: категория или тариф без
        // сопоставления с Channex меняются лишь в PMS, каналы о них не узнают (§7.3)
        setDone(
          res.queued
            ? `Сохранено изменений: ${res.applied}. В очередь каналов ушло ${res.queued} одним сообщением.`
            : `Сохранено изменений: ${res.applied}. В каналы ничего не ушло: эти категория и тариф через каналы не продаются.`,
        );
        setRows([]);
      }
    });
  const name = (code: string, list: Array<{ code: string; name: string }>) =>
    list.find((x) => x.code === code)?.name ?? code;
  return (
    <Panel size="lg" title="Массовое изменение" data-testid="bulk-editor">
      <form onSubmit={add} className="stack stack--sm">
        <Grid min={140} gap="sm">
          <Field label="Категория">
            <Select
              name="accommodationTypeCode"
              defaultValue={props.defaults.accommodationTypeCode}
              onChange={(e) => setCategory(e.target.value)}
            >
              {props.categories.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Тариф">
            <Select name="ratePlanCode" defaultValue={props.defaults.ratePlanCode}>
              {props.ratePlans.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="С даты">
            <Input type="date" name="dateFrom" defaultValue={props.defaults.dateFrom} required />
          </Field>
          <Field label="По дату">
            <Input type="date" name="dateTo" defaultValue={props.defaults.dateTo} required />
          </Field>
        </Grid>
        <div className="row hint">
          дни:
          {DAYS.map(([d, t]) => (
            <label key={d} className="check">
              <input type="checkbox" name={`day-${d}`} defaultChecked /> {t}
            </label>
          ))}
        </div>
        <Grid min={140} gap="sm">
          <Field label="Цена за ночь">
            <Input name="price" placeholder="напр. 15400" inputMode="decimal" />
          </Field>
          <Field label="Гостей (occupancy)">
            <Input name="occupancy" type="number" min={1} max={capacity} placeholder="все" />
          </Field>
          <Field label="Min stay">
            <Input name="minStay" type="number" min={0} />
          </Field>
          <Field label="Max stay">
            <Input name="maxStay" type="number" min={0} />
          </Field>
          {(
            [
              ['stopSell', 'Stop sell'],
              ['closedToArrival', 'Закрыт заезд (CTA)'],
              ['closedToDeparture', 'Закрыт выезд (CTD)'],
            ] as const
          ).map(([k, t]) => (
            <Field key={k} label={t}>
              <Select name={k} defaultValue="">
                {TRI.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
          ))}
        </Grid>
        <div>
          <Button type="submit" tone="secondary">
            + Добавить в список
          </Button>
        </div>
      </form>
      {rows.length > 0 && (
        <ul data-testid="pending-changes" className="list list--gap hint--lg">
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
              <Button
                type="button"
                tone="ghost"
                onClick={() => setRows((x) => x.filter((_, j) => j !== i))}
              >
                ×
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Row gap="lg">
        <Button
          type="button"
          data-testid="apply-changes"
          onClick={submit}
          disabled={pending || rows.length === 0}
        >
          {pending ? 'Сохраняю…' : `Сохранить (${rows.length})`}
        </Button>
        {error && <Alert>{error}</Alert>}
        {done && <Notice data-testid="bulk-done">{done}</Notice>}
      </Row>
    </Panel>
  );
}
