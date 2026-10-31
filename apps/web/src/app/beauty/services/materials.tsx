'use client';
import Link from 'next/link';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Field, Input, Select } from '../../../components/ui';
import { formatMoney } from '../../../lib/money';
import type { BeautyMaterialUnit, BeautyServiceMaterials } from '../../../lib/api';
import {
  loadBeautyServiceMaterials,
  saveBeautyServiceMaterials,
} from './material-actions';
import { useT } from '../../../i18n/locale-provider';

type MaterialDraft = { productId: string; normQty: string; unit: BeautyMaterialUnit };
const quantity = /^\d{1,9}(?:[.,]\d{1,3})?$/;

const draftsFrom = (data: BeautyServiceMaterials): MaterialDraft[] =>
  data.items.map((item) => ({ productId: item.productId, normQty: item.normQty, unit: item.unit }));

export function ServiceMaterials({
  serviceId,
  serviceName,
  scopeKey,
  initial,
  priceMinor,
}: {
  serviceId: string;
  serviceName: string;
  scopeKey: string;
  initial?: BeautyServiceMaterials;
  /** Цена услуги: маржа = цена − себестоимость техкарты (владелец 31.10.2026) */
  priceMinor?: string;
}) {
  const t = useT();
  const [data, setData] = useState<BeautyServiceMaterials | null>(initial ?? null);
  const [rows, setRows] = useState<MaterialDraft[]>(initial ? draftsFrom(initial) : []);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(initial === undefined);
  const [state, action, pending] = useActionState(saveBeautyServiceMaterials, null);

  useEffect(() => {
    if (initial) return;
    let live = true;
    setLoading(true);
    void loadBeautyServiceMaterials(serviceId, scopeKey).then((result) => {
      if (!live) return;
      if (result.data) {
        setData(result.data);
        setRows(draftsFrom(result.data));
      }
      setLoadError(result.error ?? null);
      setLoading(false);
    });
    return () => { live = false; };
  }, [initial, scopeKey, serviceId]);

  useEffect(() => {
    if (!state?.data) return;
    setData(state.data);
    setRows(draftsFrom(state.data));
    setLocalError(null);
  }, [state]);

  const original = useMemo(() => data ? JSON.stringify(draftsFrom(data)) : '[]', [data]);
  const dirty = JSON.stringify(rows) !== original;
  const available = data?.products.filter((product) => product.active) ?? [];
  const addable = available.find((product) => !rows.some((row) => row.productId === product.id));
  const costByProduct = new Map(data?.items.map((item) => [item.productId, item]) ?? []);

  if (loading) return <p role="status">{t('Загружаем техкарту…')}</p>;
  if (loadError || !data) return <Alert>{loadError ?? t('Техкарта недоступна.')}</Alert>;

  const patch = (index: number, change: Partial<MaterialDraft>) =>
    setRows((current) => current.map((row, position) => position === index ? { ...row, ...change } : row));

  return (
    <form
      action={action}
      className="beauty-material-form"
      data-testid="beauty-service-materials"
      onSubmit={(event) => {
        const normalized = rows.map((row) => ({ ...row, normQty: row.normQty.replace(',', '.') }));
        if (normalized.some((row) => !row.productId || !quantity.test(row.normQty) || /^0+(?:\.0+)?$/.test(row.normQty))) {
          event.preventDefault();
          setLocalError(t('Укажите товар и положительную норму, не больше трёх знаков после запятой.'));
          return;
        }
        if (new Set(normalized.map((row) => row.productId)).size !== normalized.length) {
          event.preventDefault();
          setLocalError(t('Один товар можно добавить в техкарту только один раз.'));
          return;
        }
        setLocalError(null);
      }}
    >
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="scopeKey" value={scopeKey} />
      <input type="hidden" name="expectedRevision" value={data.revision} />
      <input type="hidden" name="items" value={JSON.stringify(rows.map((row) => ({ ...row, normQty: row.normQty.replace(',', '.') })))} />
      <div className="beauty-material-heading">
        <div><h3>{t('Материалы')}</h3><p>{t('Норма расхода на одну услугу «{name}».', { name: serviceName })}</p></div>
        <Button
          type="button"
          tone="secondary"
          disabled={!addable}
          onClick={() => {
            if (addable) setRows([...rows, { productId: addable.id, normQty: '', unit: addable.unit }]);
          }}
        >
          {t('Добавить материал')}
        </Button>
      </div>

      {rows.length === 0 && <p className="beauty-material-empty">{t('Материалы не добавлены.')}</p>}
      <div className="beauty-material-rows">
        {rows.map((row, index) => {
          const selected = data.products.find((product) => product.id === row.productId);
          const saved = costByProduct.get(row.productId);
          const unchanged = saved?.normQty === row.normQty.replace(',', '.') && saved.unit === row.unit;
          return (
            <div className="beauty-material-row" key={`${row.productId}:${index}`}>
              <Field label={t('Материал {n}', { n: index + 1 })}>
                <Select
                  aria-label={t('Материал {n}', { n: index + 1 })}
                  value={row.productId}
                  onChange={(event) => {
                    const product = data.products.find((candidate) => candidate.id === event.target.value);
                    if (product) patch(index, { productId: product.id, unit: product.unit });
                  }}
                >
                  {data.products.filter((product) => product.active || product.id === row.productId).map((product) => (
                    <option key={product.id} value={product.id}>{product.name}{product.active ? '' : ` (${t('в архиве')})`}</option>
                  ))}
                </Select>
              </Field>
              <Field label={t('Норма, {unit}', { unit: t(row.unit) })}>
                <Input
                  aria-label={t('Норма, {unit}, материал {n}', { unit: t(row.unit), n: index + 1 })}
                  inputMode="decimal"
                  value={row.normQty}
                  onChange={(event) => patch(index, { normQty: event.target.value })}
                />
              </Field>
              <div className="beauty-material-stock">
                <span>{t('Остаток')}</span><strong>{selected?.onHand ?? saved?.onHand ?? '0'} {t(row.unit)}</strong>
              </div>
              <div className="beauty-material-cost">
                <span>{t('Себестоимость нормы')}</span>
                <strong>{unchanged && saved?.costMinor !== null && saved?.costMinor !== undefined
                  ? formatMoney(saved.costMinor, data.currency)
                  : unchanged ? t('Нет цены или остатка') : t('После сохранения')}</strong>
              </div>
              <Button
                type="button"
                tone="secondary"
                aria-label={t('Убрать материал {n}', { n: index + 1 })}
                onClick={() => setRows((current) => current.filter((_, position) => position !== index))}
              >
                {t('Убрать')}
              </Button>
            </div>
          );
        })}
      </div>

      <div className="beauty-material-total">
        <span>{t('Плановая себестоимость услуги')}</span>
        <strong>{dirty ? t('После сохранения') : data.totalCostMinor === null
          ? t('Себестоимость не рассчитана')
          : formatMoney(data.totalCostMinor, data.currency)}</strong>
      </div>
      {!dirty && priceMinor && data.totalCostMinor !== null && BigInt(priceMinor) > 0n && (() => {
        const price = BigInt(priceMinor);
        const margin = price - BigInt(data.totalCostMinor);
        return (
          <div className="beauty-material-total" data-testid="service-margin">
            <span>{t('Маржа с услуги')}</span>
            <strong>
              {formatMoney(margin.toString(), data.currency)} ({String((margin * 100n) / price)}%)
            </strong>
          </div>
        );
      })()}
      {!dirty && data.missingCost && <Alert>{t('Для части материалов нет цены партии или не хватает остатка.')}</Alert>}
      {!available.length && (
        <p>
          {t('На складе нет расходников для добавления.')}{' '}
          <Link href="/bar/consumables" prefetch={false}>{t('Добавить расходник')}</Link>
        </p>
      )}
      {(localError ?? state?.error) && <Alert>{localError ?? state?.error}</Alert>}
      {!localError && state?.message && <p role="status">{state.message}</p>}
      <Button type="submit" disabled={pending || !dirty}>{pending ? t('Сохраняем…') : t('Сохранить техкарту')}</Button>
    </form>
  );
}
