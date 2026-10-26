'use client';

import { useState, useTransition } from 'react';
import type { BeautyEmployeeServicePriceRow } from '../../lib/api';
import { minorToInput } from '../../lib/money';
import {
  removeEmployeeServicePrice,
  saveEmployeeServicePrice,
} from '../../app/my-work/actions';
import { Field, Input } from '../ui';
import { msg } from '../../i18n';
import { useT } from '../../i18n/locale-provider';

const sourceLabel: Record<BeautyEmployeeServicePriceRow['source'], string> = {
  MASTER: msg('Своя цена мастера'),
  LOCATION: msg('Цена филиала'),
  CATALOG: msg('Цена каталога'),
};

/**
 * Ключ блока цен: набор услуг мастера. Блок держит строки в своём состоянии, поэтому после «Сохранить услуги» он
 * пересоздаётся по новому ключу, иначе писал «Сначала назначьте услугу» до перезагрузки. Ревизия в ключ не входит:
 * своё «Сохранить» поднимает её и обновляет карточку с сервера, и пересозданный блок терял «Сохранено» (25.10.2026);
 * свежие строки после своего сохранения блок берёт из ответа действия.
 */
export function servicePricesKey(rows: readonly Pick<BeautyEmployeeServicePriceRow, 'serviceId'>[]): string {
  return rows.map((row) => row.serviceId).sort().join('|');
}

export function EmployeeServicePrices({
  employeeId,
  scope,
  initial,
}: {
  employeeId: string;
  scope: string;
  initial: readonly BeautyEmployeeServicePriceRow[];
}) {
  const t = useT();
  const [items, setItems] = useState<BeautyEmployeeServicePriceRow[]>([...initial]);
  const [savedServiceId, setSavedServiceId] = useState<string | null>(null);
  return <div className="portal-service-prices" data-testid="portal-service-prices">
    <h3>{t('Цена и длительность у мастера')}</h3>
    <p>{t('Настройка действует для выбранного филиала. Суммы вводятся в валюте филиала.')}</p>
    {!items.length && <p>{t('Сначала назначьте мастеру услугу в этом филиале.')}</p>}
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
  const t = useT();
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
      <div><strong>{row.serviceName}</strong><small>{t(sourceLabel[row.source])}</small></div>
      <span>{row.sellable ? t('Доступна для записи') : t('Пока недоступна')}</span>
    </header>
    <input type="hidden" name="serviceId" value={row.serviceId} />
    <input type="hidden" name="currency" value={row.currency} />
    <input type="hidden" name="expectedRevision" value={row.revision ?? 0} />
    <Field label={t('Тип цены')}>
      <select name="priceType" value={priceType} onChange={(event) => setPriceType(event.target.value as BeautyEmployeeServicePriceRow['priceType'])}>
        <option value="FIXED">{t('Фиксированная')}</option>
        <option value="RANGE">{t('Диапазон')}</option>
        <option value="FREE">{t('Бесплатно')}</option>
        <option value="UNFIXED">{t('Цена не задана')}</option>
      </select>
    </Field>
    {priceType === 'FIXED' && <Field label={t('Цена, {currency}', { currency: row.currency })}>
      <Input name="priceMin" inputMode="decimal" defaultValue={minValue} required />
    </Field>}
    {priceType === 'RANGE' && <>
      <Field label={t('Цена от, {currency}', { currency: row.currency })}><Input name="priceMin" inputMode="decimal" defaultValue={minValue} required /></Field>
      <Field label={t('Цена до, {currency}', { currency: row.currency })}><Input name="priceMax" inputMode="decimal" defaultValue={maxValue} required /></Field>
    </>}
    {priceType === 'FREE' && <><p className="portal-service-price-note">{t('Бесплатно')}</p><input type="hidden" name="priceMin" value="0" /></>}
    {priceType === 'UNFIXED' && <p className="portal-service-price-note">{t('Цена не задана, её нужно указать при записи.')}</p>}
    <Field label={t('Длительность, минут')}>
      <Input name="durationMinutes" type="number" min={1} max={1440} step={1} defaultValue={row.durationMinutes} required />
    </Field>
    <div className="portal-service-price-actions">
      <button className="btn" type="submit" disabled={pending}>{pending ? t('Сохраняем…') : t('Сохранить')}</button>
      {row.revision !== null && <button className="btn btn--secondary" type="button" disabled={pending} onClick={remove}>{t('Сбросить свою цену')}</button>}
    </div>
    {error && <p role="alert">{t(error)}</p>}
    {saved && <p role="status">{t('Сохранено')}</p>}
  </form>;
}
