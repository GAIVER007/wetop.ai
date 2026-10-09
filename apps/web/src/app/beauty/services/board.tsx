'use client';
import { useActionState, useState } from 'react';
import { parseBeautyServiceInput, parseLocationServiceInput } from '@pms/domain';
import { Overlay } from '../../../components/overlay';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Select,
  Table,
} from '../../../components/ui';
import { formatMoney } from '../../../lib/money';
import type { BeautyServiceRow } from '../../../lib/api';
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

type Editing = { mode: 'new' } | { mode: 'edit'; row: BeautyServiceRow } | null;

export function ServicesBoard({
  items,
  locationCurrency,
  canEdit,
}: {
  items: BeautyServiceRow[];
  locationCurrency: string | null;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<Editing>(null);
  return (
    <>
      <div className="beauty-bar">
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
      {items.length === 0 && (
        <EmptyState title="Добавьте первую услугу">
          Укажите название, длительность и цену, затем включите услугу в филиале.
        </EmptyState>
      )}
      <Table className="beauty-operational-table">
        <thead>
          <tr>
            <th>Услуга</th>
            <th className="beauty-col-wide">Группа</th>
            <th className="beauty-col-wide">Длительность</th>
            <th>Цена каталога</th>
            <th>В этом филиале</th>
            {canEdit && <th className="sr-only">Действия</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id}>
              <td data-label="Услуга">
                {row.name}
                {!row.active && <Badge>В архиве</Badge>}
              </td>
              <td data-label="Группа" className="beauty-col-wide">
                {row.category ?? 'Без группы'}
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
          />
        )}
      </Overlay>
    </>
  );
}

function ServiceForm({
  row,
  locationCurrency,
}: {
  row: BeautyServiceRow | null;
  locationCurrency: string | null;
}) {
  const [state, action, pending] = useActionState(saveBeautyService, null);
  const [locationState, locationAction, locationPending] = useActionState(
    saveLocationService,
    null,
  );
  // Проверяем тем же разбором, что API (SET3 делает так же): иначе серверное действие сбросило бы форму
  const [error, setError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  return (
    <>
      <form
        action={action}
        className="beauty-form"
        onSubmit={(event) => {
          const data = new FormData(event.currentTarget);
          const parsed = parseBeautyServiceInput({
            name: String(data.get('name') ?? ''),
            category: String(data.get('category') ?? ''),
            durationMinutes: String(data.get('durationMinutes') ?? ''),
            priceMinor: String(data.get('priceMinor') ?? ''),
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
        <Field label="Название">
          <Input name="name" required maxLength={200} defaultValue={row?.name ?? ''} />
        </Field>
        <Field
          label={
            <span>
              Группа <small className="beauty-note">необязательно: «Ногти», «Волосы»</small>
            </span>
          }
        >
          <Input name="category" maxLength={100} defaultValue={row?.category ?? ''} />
        </Field>
        <Field label="Длительность, минут">
          <Input
            name="durationMinutes"
            inputMode="numeric"
            required
            defaultValue={String(row?.durationMinutes ?? 60)}
          />
        </Field>
        <Field
          label={
            <span>
              Цена каталога, тиын{' '}
              <small className="beauty-note">целое число: 800000 это 8 000 тенге</small>
            </span>
          }
        >
          <Input
            name="priceMinor"
            inputMode="numeric"
            required
            defaultValue={row?.priceMinor ?? '0'}
          />
        </Field>
        <Field label="Валюта цены каталога">
          <Select name="currency" defaultValue={row?.currency ?? locationCurrency ?? 'KZT'}>
            {['KZT', 'RUB', 'USD', 'EUR', 'UZS', 'GEL', 'AED'].map((code) => (
              <option key={code}>{code}</option>
            ))}
          </Select>
        </Field>
        <label className="beauty-check">
          <input type="checkbox" name="active" defaultChecked={row?.active ?? true} />
          Услуга активна
        </label>
        {(error ?? state?.error) && <Alert>{error ?? state?.error}</Alert>}
        {!error && state?.message && <p role="status">{state.message}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? 'Сохраняем…' : 'Сохранить услугу'}
        </Button>
      </form>
      {row && (
        <form
          action={locationAction}
          className="beauty-form"
          onSubmit={(event) => {
            const data = new FormData(event.currentTarget);
            const parsed = parseLocationServiceInput({
              enabled: data.get('enabled') === 'on',
              priceOverrideMinor: String(data.get('priceOverrideMinor') ?? ''),
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
          <input type="hidden" name="id" value={row.id} />
          <label className="beauty-check">
            <input type="checkbox" name="enabled" defaultChecked={row.location?.enabled ?? false} />
            Филиал оказывает эту услугу
          </label>
          <Field
            label={
              <span>
                Своя цена филиала, тиын{' '}
                <small className="beauty-note">пусто: действует цена каталога</small>
              </span>
            }
          >
            <Input
              name="priceOverrideMinor"
              inputMode="numeric"
              defaultValue={row.location?.priceOverrideMinor ?? ''}
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
              defaultValue={
                row.location?.durationOverrideMinutes === null ||
                row.location?.durationOverrideMinutes === undefined
                  ? ''
                  : String(row.location.durationOverrideMinutes)
              }
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
