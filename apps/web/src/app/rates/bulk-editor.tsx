'use client';
import { useState, useTransition } from 'react';
import type { RateChangeInput } from '../../lib/api';
import { displayDay, displayPeriod } from '../../lib/display-date';
import { pluralRu } from '../../lib/plural';
import { Alert, Button, Field, Grid, Input, Notice, Panel, Row, Select } from '../../components/ui';
import { DateInput } from '../../components/date-field';
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
  const [category, setCategory] = useState(props.defaults.accommodationTypeCode);
  const capacity = Math.max(
    1,
    props.categories.find((c) => c.code === category)?.capacityAdults ?? 1,
  );
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
        // «Ушло в каналы» — только если очередь действительно пополнилась: несопоставленные с Channex
        // категории и тарифы издатель пропускает (волна 3)
        setDone(
          `Сохранено изменений: ${res.applied}. ${
            res.queued
              ? `В очередь каналов ушло ${res.queued} одним сообщением.`
              : 'В каналы не ушло: категория или тариф не сопоставлены с Channex.'
          }`,
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
              value={category}
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
            <DateInput name="dateFrom" defaultValue={props.defaults.dateFrom} required />
          </Field>
          <Field label="По дату">
            <DateInput
              name="dateTo"
              rangeFromName="dateFrom"
              defaultValue={props.defaults.dateTo}
              required
            />
          </Field>
        </Grid>
        {/* Подпись своей строкой, семь дней — одним рядом: в общем `.row` «вс» переносилось (21.09) */}
        <fieldset className="rates-days">
          <legend className="rates-days__legend">Дни недели</legend>
          <div className="rates-days__list">
            {DAYS.map(([d, t]) => (
              <label key={d} className="check">
                <input type="checkbox" name={`day-${d}`} defaultChecked /> {t}
              </label>
            ))}
          </div>
        </fieldset>
        <Grid min={140} gap="sm">
          <Field label="Цена за ночь">
            <Input name="price" placeholder="напр. 15400" inputMode="decimal" />
          </Field>
          <Field label="Гостей (occupancy)">
            <Input name="occupancy" type="number" min={1} max={capacity} placeholder="все" />
          </Field>
          <Field label="Мин. ночей">
            <Input name="minStay" type="number" min={0} />
          </Field>
          <Field label="Макс. ночей">
            <Input name="maxStay" type="number" min={0} />
          </Field>
          {(
            [
              ['stopSell', 'Стоп-продажа'],
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
        <ol data-testid="pending-changes" className="pending-list">
          {rows.map((r, i) => {
            const facts = [
              r.price ? `цена ${r.price}${r.occupancy ? ` (${r.occupancy} гост.)` : ''}` : '',
              r.minStay !== undefined ? `мин. ночей ${r.minStay}` : '',
              r.maxStay !== undefined ? `макс. ночей ${r.maxStay}` : '',
              r.stopSell !== undefined ? `стоп-продажа ${r.stopSell ? 'да' : 'нет'}` : '',
              r.closedToArrival !== undefined
                ? `закрыт заезд ${r.closedToArrival ? 'да' : 'нет'}`
                : '',
              r.closedToDeparture !== undefined
                ? `закрыт выезд ${r.closedToDeparture ? 'да' : 'нет'}`
                : '',
            ].filter(Boolean);
            const period =
              r.dateTo !== r.dateFrom
                ? displayPeriod(r.dateFrom, r.dateTo)
                : displayDay(r.dateFrom);
            const days = r.days
              ? ` (${r.days.map((d) => DAYS.find(([k]) => k === d)?.[1] ?? d).join(', ')})`
              : '';
            return (
              <li key={i} className="pending-list__row">
                <span>
                  {name(r.accommodationTypeCode, props.categories)},{' '}
                  {name(r.ratePlanCode, props.ratePlans)}: {period}
                  {days} — {facts.join(', ')}
                </span>
                <Button
                  type="button"
                  tone="ghost"
                  size="xs"
                  aria-label={`Убрать строку ${i + 1}`}
                  onClick={() => setRows((x) => x.filter((_, j) => j !== i))}
                >
                  ×
                </Button>
              </li>
            );
          })}
        </ol>
      )}
      <Row gap="lg">
        <Button
          type="button"
          data-testid="apply-changes"
          onClick={submit}
          disabled={pending || rows.length === 0}
        >
          {pending
            ? 'Сохраняю…'
            : rows.length
              ? `Сохранить ${pluralRu(rows.length, ['изменение', 'изменения', 'изменений'])}`
              : 'Сохранить'}
        </Button>
        {error && <Alert>{error}</Alert>}
        {done && <Notice data-testid="bulk-done">{done}</Notice>}
      </Row>
    </Panel>
  );
}
