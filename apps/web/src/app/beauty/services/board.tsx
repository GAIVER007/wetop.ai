'use client';
import { startTransition, useActionState, useEffect, useRef, useState, type DragEvent } from 'react';
import { currencyOptions, parseBeautyServiceInput, parseLocationServiceInput } from '@pms/domain';
import { Overlay } from '../../../components/overlay';
import { Alert, Badge, Button, Field, Input, Select } from '../../../components/ui';
import { formatMoney, inputToMinor, minorToInput } from '../../../lib/money';
import type { BeautyServiceRow } from '../../../lib/api';
import { pendingCreation, useCreationKey } from '../creation-key';
import { saveBeautyService, saveLocationService } from '../actions';
import { ServiceMaterials } from './materials';
import './services.css';

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
type ServicePreset = { name: string; category: string; minutes: number };

const PRESETS: ServicePreset[] = [
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

type Editing =
  | { mode: 'new'; preset?: ServicePreset; enableForLocation?: boolean }
  | { mode: 'edit'; row: BeautyServiceRow }
  | null;

export function ServicesBoard({
  items,
  locationCurrency,
  canEdit,
  canCreate = canEdit ?? false,
  canUpdate = canEdit ?? false,
  canDelete = canEdit ?? false,
  scopeKey = '',
}: {
  items: BeautyServiceRow[];
  locationCurrency: string | null;
  canEdit?: boolean;
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
  scopeKey?: string;
}) {
  const [editing, setEditing] = useState<Editing>(null);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [draggedServiceId, setDraggedServiceId] = useState<string | null>(null);
  const [draggedPresetName, setDraggedPresetName] = useState<string | null>(null);
  const [materialService, setMaterialService] = useState<BeautyServiceRow | null>(null);
  const [transferState, transferAction, transferPending] = useActionState(saveLocationService, null);
  const needle = search.trim().toLocaleLowerCase('ru-RU');
  const filtered = items.filter(row => !needle || `${row.name} ${row.category ?? ''}`.toLocaleLowerCase('ru-RU').includes(needle));
  const active = filtered.filter((row) => row.active);
  const salon = active.filter((row) => row.location?.enabled === true);
  const catalog = showArchived ? filtered : active;
  const persistedNames = new Set(items.map((row) => row.name.trim().toLocaleLowerCase('ru-RU')));
  const presetCatalog = PRESETS.filter((preset) => {
    if (persistedNames.has(preset.name.toLocaleLowerCase('ru-RU'))) return false;
    return !needle || `${preset.name} ${preset.category}`.toLocaleLowerCase('ru-RU').includes(needle);
  });
  const archivedCount = items.filter((row) => !row.active).length;
  const transferDisabled = transferPending || !locationCurrency;

  const submitTransfer = (row: BeautyServiceRow, enabled: boolean) => {
    if (transferDisabled || !row.active || Boolean(row.location?.enabled) === enabled) return;
    const form = locationTransferFormData(row, enabled, scopeKey);
    startTransition(() => transferAction(form));
  };
  const dropInto = (event: DragEvent<HTMLElement>, enabled: boolean) => {
    event.preventDefault();
    const preset = PRESETS.find((item) => item.name === draggedPresetName);
    const row = items.find((item) => item.id === draggedServiceId);
    setDraggedServiceId(null);
    setDraggedPresetName(null);
    if (preset && enabled && canCreate) {
      setEditing({ mode: 'new', preset, enableForLocation: true });
    } else if (row && canUpdate) submitTransfer(row, enabled);
  };
  useEffect(() => {
    const id = pendingCreation(scopeKey, 'service');
    const row = items.find((item) => item.id === id);
    if (row) setEditing((current) => current === null ? { mode: 'edit', row } : current);
  }, [scopeKey, items]);
  return (
    <>
      <div className="beauty-service-dual-toolbar">
        <Field label="Поиск услуг"><Input type="search" aria-label="Поиск услуг" placeholder="Название или категория" value={search} onChange={event => setSearch(event.target.value)} /></Field>
        <p role="status">
          {items.length === 0
            ? 'Добавьте первую услугу'
            : `В салоне: ${salon.length}. В каталоге: ${active.length}`}
        </p>
        <label className="beauty-check beauty-service-archive-filter">
          <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />
          Показать архив{archivedCount > 0 ? ` (${archivedCount})` : ''}
        </label>
        {canCreate && (
          <Button type="button" onClick={() => setEditing({ mode: 'new' })}>
            Добавить услугу
          </Button>
        )}
      </div>
      {!locationCurrency && <Alert>Выберите филиал, чтобы добавлять и убирать его услуги.</Alert>}
      {transferState?.error && <Alert>{transferState.error}</Alert>}
      {!transferState?.error && transferState?.message && <p role="status">{transferState.message}</p>}
      <div className="beauty-service-transfer-board">
        <section
          className="beauty-service-list beauty-service-list--salon"
          data-service-list="salon"
          onDragOver={(event) => (canCreate || canUpdate) && event.preventDefault()}
          onDrop={(event) => dropInto(event, true)}
        >
          <header>
            <div>
              <h2>Услуги салона</h2>
              <p>Доступны для записи в выбранном филиале</p>
            </div>
            <Badge>{salon.length}</Badge>
          </header>
          <div className="beauty-service-items">
            {salon.map((row) => (
              <article
                className="beauty-service-item"
                draggable={canUpdate && row.active}
                key={row.id}
                onDragStart={() => { setDraggedPresetName(null); setDraggedServiceId(row.id); }}
                onDragEnd={() => setDraggedServiceId(null)}
              >
                <ServiceIdentity row={row} location />
                {canUpdate && (
                  <TransferForm
                    row={row}
                    enabled={false}
                    scopeKey={scopeKey}
                    action={transferAction}
                    disabled={transferDisabled}
                  />
                )}
              </article>
            ))}
            {salon.length === 0 && <p className="beauty-service-empty">Перенесите услуги из каталога справа.</p>}
          </div>
        </section>

        <div className="beauty-service-transfer-hint" aria-hidden="true">
          <span>←</span>
          <span>→</span>
        </div>

        <section
          className="beauty-service-list beauty-service-list--catalog"
          data-service-list="catalog"
          onDragOver={(event) => canUpdate && event.preventDefault()}
          onDrop={(event) => dropInto(event, false)}
        >
          <header>
            <div>
              <h2>Каталог услуг</h2>
              <p>Все услуги сети, доступные для добавления</p>
            </div>
            <Badge>{catalog.length + presetCatalog.length}</Badge>
          </header>
          <div className="beauty-service-items">
            {catalog.map((row) => {
              const selected = row.location?.enabled === true;
              return (
                <article
                  className="beauty-service-item"
                  draggable={canUpdate && row.active}
                  key={row.id}
                  onDragStart={() => { setDraggedPresetName(null); setDraggedServiceId(row.id); }}
                  onDragEnd={() => setDraggedServiceId(null)}
                >
                  <ServiceIdentity row={row} popularity locationCurrency={locationCurrency} />
                  <div className="beauty-service-item-actions">
                    {selected && <Badge>В салоне</Badge>}
                    {!row.active && <Badge>В архиве</Badge>}
                    {canUpdate && (selected ? (
                      <Button type="button" size="sm" tone="secondary" disabled aria-label={`В салоне: ${row.name}`}>
                        В салоне
                      </Button>
                    ) : row.active ? (
                      <TransferForm
                        row={row}
                        enabled
                        scopeKey={scopeKey}
                        action={transferAction}
                        disabled={transferDisabled}
                      />
                    ) : null)}
                    {canUpdate && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          tone="secondary"
                          aria-label={`Техкарта услуги: ${row.name}`}
                          onClick={() => setMaterialService(row)}
                        >
                          Материалы
                        </Button>
                        <Button type="button" size="sm" tone="secondary" onClick={() => setEditing({ mode: 'edit', row })}>
                          Изменить
                        </Button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
            {presetCatalog.map((preset) => (
              <article
                className="beauty-service-item beauty-service-item--preset"
                draggable={canCreate}
                key={`preset:${preset.name}`}
                onDragStart={() => { setDraggedServiceId(null); setDraggedPresetName(preset.name); }}
                onDragEnd={() => setDraggedPresetName(null)}
              >
                <div className="beauty-service-item-body">
                  <b>{preset.name}</b>
                  <span>{preset.minutes} мин</span>
                  <small>{preset.category}</small>
                  <small>Цена задаётся при добавлении</small>
                </div>
                {canCreate && <div className="beauty-service-item-actions">
                  <Button
                    type="button"
                    size="sm"
                    tone="secondary"
                    aria-label={`Настроить и добавить в салон: ${preset.name}`}
                    onClick={() => setEditing({ mode: 'new', preset, enableForLocation: true })}
                  >
                    ← Настроить
                  </Button>
                </div>}
              </article>
            ))}
            {catalog.length === 0 && presetCatalog.length === 0 && <p className="beauty-service-empty">Услуги не найдены. Измените поиск или добавьте новую услугу.</p>}
          </div>
        </section>
      </div>
      {items.length > 0 && filtered.length === 0 && <p role="status">Услуги не найдены. Измените название или категорию.</p>}
      <Overlay
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.mode === 'edit' ? 'Услуга каталога' : editing?.mode === 'new' && editing.preset ? 'Настройка типовой услуги' : 'Новая услуга'}
        drawer
      >
        {editing && (
          <ServiceForm
            key={editing.mode === 'edit' ? editing.row.id : `new:${editing.preset?.name ?? 'custom'}`}
            row={editing.mode === 'edit' ? editing.row : null}
            {...(editing.mode === 'new' && editing.preset ? { preset: editing.preset } : {})}
            enableForLocation={editing.mode === 'new' && editing.enableForLocation === true}
            locationCurrency={locationCurrency}
            scopeKey={scopeKey}
            canDelete={canDelete}
          />
        )}
      </Overlay>
      <Overlay
        open={materialService !== null}
        onClose={() => setMaterialService(null)}
        title={materialService ? `Техкарта: ${materialService.name}` : 'Техкарта услуги'}
        drawer
      >
        {materialService && (
          <ServiceMaterials
            key={materialService.id}
            serviceId={materialService.id}
            serviceName={materialService.name}
            scopeKey={scopeKey}
          />
        )}
      </Overlay>
    </>
  );
}

function locationTransferFormData(row: BeautyServiceRow, enabled: boolean, scopeKey: string) {
  const form = new FormData();
  form.set('id', row.id);
  form.set('scopeKey', scopeKey);
  form.set('priceOverrideMinor', row.location?.priceOverrideMinor ?? '');
  form.set('durationOverrideMinutes', row.location?.durationOverrideMinutes == null ? '' : String(row.location.durationOverrideMinutes));
  if (enabled) form.set('enabled', 'on');
  return form;
}

function TransferForm({
  row,
  enabled,
  scopeKey,
  action,
  disabled,
}: {
  row: BeautyServiceRow;
  enabled: boolean;
  scopeKey: string;
  action: (payload: FormData) => void;
  disabled: boolean;
}) {
  return (
    <form action={action} className="beauty-service-transfer-form">
      <input type="hidden" name="id" value={row.id} />
      <input type="hidden" name="scopeKey" value={scopeKey} />
      <input type="hidden" name="priceOverrideMinor" value={row.location?.priceOverrideMinor ?? ''} />
      <input type="hidden" name="durationOverrideMinutes" value={row.location?.durationOverrideMinutes ?? ''} />
      {enabled && <input type="hidden" name="enabled" value="on" />}
      <Button
        type="submit"
        size="sm"
        tone="secondary"
        disabled={disabled}
        aria-label={`${enabled ? 'Добавить в салон' : 'Убрать из салона'}: ${row.name}`}
      >
        {enabled && <span aria-hidden="true">←</span>}{enabled ? 'Добавить' : 'Убрать'}{!enabled && <span aria-hidden="true">→</span>}
      </Button>
    </form>
  );
}

function ServiceIdentity({
  row,
  location = false,
  popularity = false,
  locationCurrency,
}: {
  row: BeautyServiceRow;
  location?: boolean;
  popularity?: boolean;
  locationCurrency?: string | null;
}) {
  const price = location && row.effective?.sellable
    ? `${formatMoney(row.effective.priceMinor, row.effective.currency)}, ${row.effective.durationMinutes} мин`
    : `${formatMoney(row.priceMinor, row.currency)}, ${row.durationMinutes} мин`;
  return (
    <div className="beauty-service-item-body">
      <b>{row.name}</b>
      <span>{price}</span>
      <small>{row.category ?? 'Без категории'}</small>
      {location && row.effective && !row.effective.sellable && (
        <small>{NOT_SELLABLE[row.effective.reason] ?? 'Не продаётся'}</small>
      )}
      {popularity && (
        row.popularity ? row.popularity.totalCompletedVisits > 0 ? (
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
        ) : 'Нет завершённых визитов' : locationCurrency ? 'Нет данных' : 'Выберите филиал'
      )}
    </div>
  );
}

function ServiceForm({
  row,
  preset,
  enableForLocation = false,
  locationCurrency,
  scopeKey,
  canDelete,
}: {
  scopeKey: string;
  row: BeautyServiceRow | null;
  preset?: ServicePreset;
  enableForLocation?: boolean;
  locationCurrency: string | null;
  canDelete: boolean;
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
    name: row?.name ?? preset?.name ?? '',
    category: row?.category ?? preset?.category ?? '',
    durationMinutes: String(row?.durationMinutes ?? preset?.minutes ?? 60),
    price: row ? minorToInput(row.priceMinor) : '',
    currency: row?.currency ?? locationCurrency ?? 'KZT',
    active: row?.active ?? true,
  });
  const [draft, setDraft] = useState(original);
  const submittedDraft = useRef(original);
  useEffect(() => {
    if (state?.message && !state.error) setOriginal(submittedDraft.current);
  }, [state]);
  const [local, setLocal] = useState({
    enabled: row?.location?.enabled ?? enableForLocation,
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
            disabled={Boolean(row) && !canDelete}
            onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
          />
          {row && !canDelete && draft.active && <input type="hidden" name="active" value="on" />}
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
