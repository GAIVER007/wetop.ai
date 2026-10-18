'use client';

import { useState, useTransition } from 'react';
import type { BeautyEmployeeServicePriceRow } from '../../lib/api';
import { minorToInput } from '../../lib/money';
import {
  removeEmployeeServicePrice,
  saveEmployeeServicePrice,
} from '../../app/my-work/actions';
import { Field, Input } from '../ui';

const sourceLabel: Record<BeautyEmployeeServicePriceRow['source'], string> = {
  MASTER: 'Своя цена мастера',
  LOCATION: 'Цена филиала',
  CATALOG: 'Цена каталога',
};

export function EmployeeServicePrices({
  employeeId,
  scope,
  initial,
}: {
  employeeId: string;
  scope: string;
  initial: readonly BeautyEmployeeServicePriceRow[];
}) {
  const [items, setItems] = useState<BeautyEmployeeServicePriceRow[]>([...initial]);
  const [savedServiceId, setSavedServiceId] = useState<string | null>(null);
  return <div className="portal-service-prices" data-testid="portal-service-prices">
    <h3>Цена и длительность у мастера</h3>
    <p>Настройка действует для выбранного филиала. Суммы вводятся в валюте филиала.</p>
    {!items.length && <p>Сначала назначьте мастеру услугу в этом филиале.</p>}
    {items.map((row) => <ServicePriceForm
      key={`${row.serviceId}:${row.revision ?? 0}:${row.priceType}`}
      row={row}
      employeeId={employeeId}
      scope={scope}
      saved={savedServiceId === row.serviceId}
      onSaving={() => setSavedServiceId(null)}
      onSaved={(next) => {
        setItems(next);
        setSavedServiceId(row.serviceId);
      }}
    />)}
  </div>;
}

function ServicePriceForm({
  row,
  employeeId,
  scope,
  saved,
  onSaving,
  onSaved,
}: {
  row: BeautyEmployeeServicePriceRow;
  employeeId: string;
  scope: string;
  saved: boolean;
  onSaving: () => void;
  onSaved: (items: BeautyEmployeeServicePriceRow[]) => void;
}) {
  const [priceType, setPriceType] = useState(row.priceType);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const save = (form: FormData) => startTransition(async () => {
    setError(null);
    onSaving();
    const result = await saveEmployeeServicePrice(employeeId, scope, form);
    if (result.error) return setError(result.error);
    if (result.items) onSaved(result.items);
  });
  const remove = () => startTransition(async () => {
    setError(null);
    onSaving();
    const form = new FormData();
    form.set('serviceId', row.serviceId);
    form.set('expectedRevision', String(row.revision ?? 0));
    const result = await removeEmployeeServicePrice(employeeId, scope, form);
    if (result.error) return setError(result.error);
    if (result.items) onSaved(result.items);
  });
  const minValue = row.priceMinMinor === null ? '' : minorToInput(row.priceMinMinor);
  const maxValue = row.priceMaxMinor === null ? '' : minorToInput(row.priceMaxMinor);

  return <form action={save} className="portal-service-price-form">
    <header>
      <div><strong>{row.serviceName}</strong><small>{sourceLabel[row.source]}</small></div>
      <span>{row.sellable ? 'Доступна для записи' : 'Пока недоступна'}</span>
    </header>
    <input type="hidden" name="serviceId" value={row.serviceId} />
    <input type="hidden" name="currency" value={row.currency} />
    <input type="hidden" name="expectedRevision" value={row.revision ?? 0} />
    <Field label="Тип цены">
      <select name="priceType" value={priceType} onChange={(event) => setPriceType(event.target.value as BeautyEmployeeServicePriceRow['priceType'])}>
        <option value="FIXED">Фиксированная</option>
        <option value="RANGE">Диапазон</option>
        <option value="FREE">Бесплатно</option>
        <option value="UNFIXED">Цена не задана</option>
      </select>
    </Field>
    {priceType === 'FIXED' && <Field label={`Цена, ${row.currency}`}>
      <Input name="priceMin" inputMode="decimal" defaultValue={minValue} required />
    </Field>}
    {priceType === 'RANGE' && <>
      <Field label={`Цена от, ${row.currency}`}><Input name="priceMin" inputMode="decimal" defaultValue={minValue} required /></Field>
      <Field label={`Цена до, ${row.currency}`}><Input name="priceMax" inputMode="decimal" defaultValue={maxValue} required /></Field>
    </>}
    {priceType === 'FREE' && <><p className="portal-service-price-note">Бесплатно</p><input type="hidden" name="priceMin" value="0" /></>}
    {priceType === 'UNFIXED' && <p className="portal-service-price-note">Цена не задана, её нужно указать при записи.</p>}
    <Field label="Длительность, минут">
      <Input name="durationMinutes" type="number" min={1} max={1440} step={1} defaultValue={row.durationMinutes} required />
    </Field>
    <div className="portal-service-price-actions">
      <button className="btn" type="submit" disabled={pending}>{pending ? 'Сохраняем…' : 'Сохранить'}</button>
      {row.revision !== null && <button className="btn btn--secondary" type="button" disabled={pending} onClick={remove}>Сбросить свою цену</button>}
    </div>
    {error && <p role="alert">{error}</p>}
    {saved && <p role="status">Сохранено</p>}
  </form>;
}
