'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import { currencyOptions, parseBeautyServiceInput, parseLocationServiceInput } from '@pms/domain';
import { Overlay } from '../../../components/overlay';
import { Alert, Badge, Button, Field, Input, Select, Table } from '../../../components/ui';
import { formatMoney, inputToMinor, minorToInput } from '../../../lib/money';
import type { BeautyServiceRow } from '../../../lib/api';
import { pendingCreation, useCreationKey } from '../creation-key';
import { saveBeautyService, saveLocationService } from '../actions';

/**
 * Каталог услуг салона (DATA_MODEL §19.1, срез B3). Каталог принадлежит сети, цену и доступность решает
 * филиал: поэтому в строке две цены, каталога и филиала, и видно, что услуга в этом филиале не продаётся.
 * Новых компонентов нет: `Table`, `Overlay`, `Field` и `Badge` стойки.
 */
const NOT_SELLABLE: Record<string, string> = {
  SERVICE_INACTIVE: 'В архиве',
  NOT_ENABLED: 'Филиал не оказывает',
  CURRENCY_MISMATCH: 'Нужна цена филиала: валюта каталога другая',
};

/** Типовые услуги салона: подставляют название, группу и обычную длительность. Цену человек вводит сам */
const PRESETS: Array<{ name: string; category: string; minutes: number }> = [
  { name: 'Стрижка мужская', category: 'Волосы', minutes: 45 },
  { name: 'Стрижка женская', category: 'Волосы', minutes: 60 },
  { name: 'Стрижка детская', category: 'Волосы', minutes: 30 },
  { name: 'Окрашивание волос', category: 'Волосы', minutes: 120 },
  { name: 'Укладка', category: 'Волосы', minutes: 45 },
  { name: 'Маникюр', category: 'Ногти', minutes: 60 },
  { name: 'Маникюр с покрытием', category: 'Ногти', minutes: 90 },
  { name: 'Педикюр', category: 'Ногти', minutes: 90 },
  { name: 'Коррекция бровей', category: 'Брови и ресницы', minutes: 30 },
  { name: 'Окрашивание бровей', category: 'Брови и ресницы', minutes: 30 },
  { name: 'Наращивание ресниц', category: 'Брови и ресницы', minutes: 120 },
  { name: 'Макияж', category: 'Макияж', minutes: 60 },
  { name: 'Чистка лица', category: 'Уход за лицом', minutes: 60 },
  { name: 'Массаж', category: 'Массаж', minutes: 60 },
];

type Editing = { mode: 'new' } | { mode: 'edit'; row: BeautyServiceRow } | null;

export function ServicesBoard({
  items,
  locationCurrency,
  canEdit,
  scopeKey = '',
}: {
  items: BeautyServiceRow[];
  locationCurrency: string | null;
  canEdit: boolean;
  scopeKey?: string;
}) {
  const [editing, setEditing] = useState<Editing>(null);
  const [search, setSearch] = useState('');
  const needle = search.trim().toLocaleLowerCase('ru-RU');
  const filtered = items.filter(row => !needle || `${row.name} ${row.category ?? ''}`.toLocaleLowerCase('ru-RU').includes(needle));
  useEffect(() => {
    const id = pendingCreation(scopeKey, 'service');
    const row = items.find((item) => item.id === id);
    if (row) setEditing({ mode: 'edit', row });
  }, [scopeKey, items]);
  return (
    <>
      <div className="beauty-bar">
        <Field label="Поиск услуг"><Input type="search" aria-label="Поиск услуг" placeholder="Название или категория" value={search} onChange={event => setSearch(event.target.value)} /></Field>
        <p role="status">
          {items.length === 0
            ? 'Добавьте первую услугу'
            : `Услуг в каталоге: ${items.length}, из них в архиве ${items.filter((i) => !i.active).length}`}
        </p>
        {canEdit && (
          <Button type="button" onClick={() => setEditing({ mode: 'new' })}>
            Добавить услугу
          </Button>
        )}
      </div>
      <Table className="beauty-operational-table">
        <thead>
          <tr>
            <th>Услуга</th>
            <th className="beauty-col-wide">Категория</th>
            <th className="beauty-col-wide">Длительность</th>
            <th>Цена каталога</th>
            <th>В этом филиале</th>
            <th>Популярность за 30 дней</th>
            {canEdit && <th className="sr-only">Действия</th>}
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => (
            <tr key={row.id}>
              <td data-label="Услуга">
                {row.name}
                {!row.active && <Badge>В архиве</Badge>}
              </td>
              <td data-label="Категория" className="beauty-col-wide">
                {row.category ?? 'Без категории'}
              </td>
              <td data-label="Длительность" className="beauty-col-wide">
                {row.durationMinutes} мин
              </td>
              <td data-label="Цена каталога">{formatMoney(row.priceMinor, row.currency)}</td>
              <td data-label="В этом филиале">
                {row.effective === null
                  ? 'Выберите филиал'
                  : row.effective.sellable
                    ? `${formatMoney(row.effective.priceMinor, row.effective.currency)}, ${row.effective.durationMinutes} мин${row.effective.overridden ? ' (своя цена филиала)' : ''}`
                    : (NOT_SELLABLE[row.effective.reason] ?? 'Не продаётся')}
              </td>
              <td data-label="Популярность за 30 дней">
                {row.popularity ? row.popularity.totalCompletedVisits > 0 ? (
                  <div className="beauty-popularity">
                    <b>{new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(
                      row.popularity.completedVisits * 100 / row.popularity.totalCompletedVisits,
                    )}%</b>
                    <progress
                      aria-label={`Доля завершённых визитов услуги ${row.name}`}
                      value={row.popularity.completedVisits}
                      max={row.popularity.totalCompletedVisits}
                    />
                    <small>{row.popularity.completedVisits} из {row.popularity.totalCompletedVisits} завершённых визитов</small>
                  </div>
                ) : 'Нет завершённых визитов' : locationCurrency ? 'Нет данных' : 'Выберите филиал'}
              </td>
              {canEdit && (
                <td data-label="Действия">
                  <Button
                    type="button"
                    size="sm"
                    tone="secondary"
                    onClick={() => setEditing({ mode: 'edit', row })}
                  >
                    Изменить
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </Table>
      {items.length > 0 && filtered.length === 0 && <p role="status">Услуги не найдены. Измените название или категорию.</p>}
      <Overlay
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.mode === 'edit' ? 'Услуга каталога' : 'Новая услуга'}
        drawer
      >
        {editing && (
          <ServiceForm
            key={editing.mode === 'edit' ? editing.row.id : 'new'}
            row={editing.mode === 'edit' ? editing.row : null}
            locationCurrency={locationCurrency}
            scopeKey={scopeKey}
          />
        )}
      </Overlay>
    </>
  );
}

function ServiceForm({
  row,
  locationCurrency,
  scopeKey,
}: {
  scopeKey: string;
  row: BeautyServiceRow | null;
  locationCurrency: string | null;
}) {
  const creation = useCreationKey(scopeKey, 'service', Boolean(row));
  const [state, action, pending] = useActionState(saveBeautyService, null);
  const [locationState, locationAction, locationPending] = useActionState(
    saveLocationService,
    null,
  );
  // Проверяем тем же разбором, что API (SET3 делает так же): иначе серверное действие сбросило бы форму
  const [error, setError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [original, setOriginal] = useState({
    name: row?.name ?? '',
    category: row?.category ?? '',
    durationMinutes: String(row?.durationMinutes ?? 60),
    price: minorToInput(row?.priceMinor ?? '0'),
    currency: row?.currency ?? locationCurrency ?? 'KZT',
    active: row?.active ?? true,
  });
  const [draft, setDraft] = useState(original);
  const submittedDraft = useRef(original);
  useEffect(() => {
    if (state?.message && !state.error) setOriginal(submittedDraft.current);
  }, [state]);
  const [local, setLocal] = useState({
    enabled: row?.location?.enabled ?? false,
    priceOverride:
      row?.location?.priceOverrideMinor == null ? '' : minorToInput(row.location.priceOverrideMinor),
    durationOverrideMinutes:
      row?.location?.durationOverrideMinutes == null
        ? ''
        : String(row.location.durationOverrideMinutes),
  });
  const resourceId = row?.id ?? state?.resourceId;
  const priceMinor = inputToMinor(draft.price);
  const overrideMinor = inputToMinor(local.priceOverride);
  useEffect(() => {
    if (locationState?.message) creation.clear();
  }, [locationState?.message]);
  return (
    <>
      <form
        action={action}
        className="beauty-form"
        onSubmit={(event) => {
          submittedDraft.current = { ...draft };
          const data = new FormData(event.currentTarget);
          if (priceMinor === null || priceMinor === '') {
            event.preventDefault();
            setError('Цена: число, например 5000 или 5000,50');
            return;
          }
          const parsed = parseBeautyServiceInput({
            name: String(data.get('name') ?? ''),
            category: String(data.get('category') ?? ''),
            durationMinutes: String(data.get('durationMinutes') ?? ''),
            priceMinor: priceMinor ?? '',
            currency: String(data.get('currency') ?? ''),
            active: data.get('active') === 'on',
          });
          if (!parsed.ok) {
            event.preventDefault();
            setError(parsed.reason);
            return;
          }
          setError(null);
        }}
      >
        <input type="hidden" name="id" value={row?.id ?? ''} />
        <input type="hidden" name="scopeKey" value={scopeKey} />
        {row && (
          <input
            type="hidden"
            name="changedFields"
            value={JSON.stringify(
              (Object.keys(draft) as Array<keyof typeof draft>)
                .filter((key) => draft[key] !== original[key])
                .map((key) => (key === 'price' ? 'priceMinor' : key)),
            )}
          />
        )}
        {!row && <input type="hidden" name="creationId" value={creation.id} />}
        <input type="hidden" name="priceMinor" value={priceMinor ?? ''} />
        {!row && (
          <Field label="Типовая услуга">
            <Select
              aria-label="Типовая услуга"
              value=""
              onChange={(e) => {
                const preset = PRESETS.find((p) => p.name === e.target.value);
                if (preset)
                  setDraft({
                    ...draft,
                    name: preset.name,
                    category: preset.category,
                    durationMinutes: String(preset.minutes),
                  });
              }}
            >
              <option value="">Выбрать из списка или ввести своё ниже</option>
              {PRESETS.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}, {p.minutes} мин
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Название">
          <Input
            name="name"
            required
            maxLength={200}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </Field>
        <Field
          label={
            <span>
              Группа <small className="beauty-note">необязательно: «Ногти», «Волосы»</small>
            </span>
          }
        >
          <Input
            name="category"
            maxLength={100}
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
          />
        </Field>
        <Field label="Длительность, минут">
          <Input
            name="durationMinutes"
            inputMode="numeric"
            required
            value={draft.durationMinutes}
            onChange={(e) => setDraft({ ...draft, durationMinutes: e.target.value })}
          />
        </Field>
        <Field
          label={
            <span>
              Цена каталога, {draft.currency}{' '}
              <small className="beauty-note">например 5000</small>
            </span>
          }
        >
          <Input
            inputMode="decimal"
            required
            value={draft.price}
            onChange={(e) => setDraft({ ...draft, price: e.target.value })}
          />
        </Field>
        <Field label="Валюта цены каталога">
          <Select
            name="currency"
            value={draft.currency}
            onChange={(e) => setDraft({ ...draft, currency: e.target.value })}
          >
            {currencyOptions(draft.currency).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <label className="beauty-check">
          <input
            type="checkbox"
            name="active"
            checked={draft.active}
            onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
          />
          Услуга активна
        </label>
        {(creation.error || error || state?.error) && (
          <Alert>{creation.error || error || state?.error}</Alert>
        )}
        {!error && state?.message && <p role="status">{state.message}</p>}
        <Button type="submit" disabled={pending || (!row && !creation.id)}>
          {pending ? 'Сохраняем…' : 'Сохранить услугу'}
        </Button>
      </form>
      {resourceId && (
        <form
          action={locationAction}
          className="beauty-form"
          onSubmit={(event) => {
            const data = new FormData(event.currentTarget);
            if (overrideMinor === null) {
              event.preventDefault();
              setLocationError('Своя цена: число, например 5000, или пусто');
              return;
            }
            const parsed = parseLocationServiceInput({
              enabled: data.get('enabled') === 'on',
              priceOverrideMinor: overrideMinor ?? '',
              durationOverrideMinutes: String(data.get('durationOverrideMinutes') ?? ''),
            });
            if (!parsed.ok) {
              event.preventDefault();
              setLocationError(parsed.reason);
              return;
            }
            setLocationError(null);
          }}
        >
          <h3>В этом филиале</h3>
          <input type="hidden" name="id" value={resourceId} />
          <input type="hidden" name="priceOverrideMinor" value={overrideMinor ?? ''} />
          <input type="hidden" name="scopeKey" value={scopeKey} />
          <label className="beauty-check">
            <input
              type="checkbox"
              name="enabled"
              checked={local.enabled}
              onChange={(e) => setLocal({ ...local, enabled: e.target.checked })}
            />
            Филиал оказывает эту услугу
          </label>
          <Field
            label={
              <span>
                Своя цена филиала, {locationCurrency ?? draft.currency}{' '}
                <small className="beauty-note">пусто: действует цена каталога</small>
              </span>
            }
          >
            <Input
              inputMode="decimal"
              value={local.priceOverride}
              onChange={(e) => setLocal({ ...local, priceOverride: e.target.value })}
            />
          </Field>
          <Field
            label={
              <span>
                Своя длительность, минут{' '}
                <small className="beauty-note">пусто: действует длительность каталога</small>
              </span>
            }
          >
            <Input
              name="durationOverrideMinutes"
              inputMode="numeric"
              value={local.durationOverrideMinutes}
              onChange={(e) => setLocal({ ...local, durationOverrideMinutes: e.target.value })}
            />
          </Field>
          {(locationError ?? locationState?.error) && (
            <Alert>{locationError ?? locationState?.error}</Alert>
          )}
          {!locationError && locationState?.message && <p role="status">{locationState.message}</p>}
          <Button type="submit" tone="secondary" disabled={locationPending}>
            {locationPending ? 'Сохраняем…' : 'Сохранить для филиала'}
          </Button>
        </form>
      )}
    </>
  );
}
