'use client';
import { startTransition, useActionState, useEffect, useRef, useState, type DragEvent } from 'react';
import { currencyOptions, parseBeautyServiceInput, parseLocationServiceInput } from '@pms/domain';
import { Overlay } from '../../../components/overlay';
import { Alert, Badge, Button, Field, Input, Select } from '../../../components/ui';
import { inputToMinor, minorToInput } from '../../../lib/money';
import type { BeautyServiceRow } from '../../../lib/api';
import { pendingCreation, useCreationKey } from '../creation-key';
import { moveLocationServices, saveBeautyService, saveLocationService } from '../actions';
import { PRESETS, type ServicePreset } from './presets';
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
  const [bulkState, bulkAction, bulkPending] = useActionState(moveLocationServices, null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [notice, setNotice] = useState<{ error?: string; message?: string } | null>(null);
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
  const busy = transferPending || bulkPending;
  const transferDisabled = busy || !locationCurrency;

  // Что можно отметить: слева услуги филиала, справа то, чего в филиале ещё нет (включая типовые)
  const salonKeys = salon.map((row) => `id:${row.id}`);
  const catalogKeys = [
    ...catalog.filter((row) => row.active && row.location?.enabled !== true).map((row) => `id:${row.id}`),
    ...presetCatalog.map((preset) => `preset:${preset.name}`),
  ];
  const salonSelected = salonKeys.filter((key) => selected.has(key));
  const catalogSelected = catalogKeys.filter((key) => selected.has(key));
  const toggle = (key: string, on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  const toggleAll = (keys: string[], on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      for (const key of keys) {
        if (on) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  const submitBulk = (keys: string[], enable: boolean) => {
    if (transferDisabled || keys.length === 0) return;
    const form = new FormData();
    form.set('scopeKey', scopeKey);
    form.set('direction', enable ? 'enable' : 'disable');
    for (const key of keys) {
      if (key.startsWith('preset:')) form.append('preset', key.slice('preset:'.length));
      else form.append('id', key.slice('id:'.length));
    }
    startTransition(() => bulkAction(form));
  };
  // Результат любого переноса один раз показывается в общей строке; отметки после него сбрасываются
  useEffect(() => {
    if (bulkState) {
      setNotice(bulkState);
      setSelected(new Set());
    }
  }, [bulkState]);
  useEffect(() => {
    if (transferState) setNotice(transferState);
  }, [transferState]);

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
    // Тянут отмеченную строку: переносим всю отметку целиком, а не одну услугу
    const group = enabled ? catalogSelected : salonSelected;
    const dragKey = preset ? `preset:${preset.name}` : row ? `id:${row.id}` : null;
    if (dragKey && group.length > 1 && group.includes(dragKey) && (canCreate || canUpdate)) {
      submitBulk(group, enabled);
    } else if (preset && enabled && canCreate) {
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
            : `В филиале: ${salon.length}. В каталоге: ${active.length}`}
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
      {notice?.error && <Alert>{notice.error}</Alert>}
      {!notice?.error && notice?.message && <p role="status">{notice.message}</p>}
      <div className="beauty-service-transfer-board">
        <section
          className="beauty-service-list beauty-service-list--salon"
          data-service-list="salon"
          onDragOver={(event) => (canCreate || canUpdate) && event.preventDefault()}
          onDrop={(event) => dropInto(event, true)}
        >
          <header>
            <div>
              <h2>Услуги филиала</h2>
              <p>Доступны для записи в выбранном филиале</p>
            </div>
            <Badge>{salon.length}</Badge>
          </header>
          {canUpdate && salonKeys.length > 0 && (
            <SelectionBar
              label="услуги филиала"
              keys={salonKeys}
              selectedCount={salonSelected.length}
              onToggleAll={(on) => toggleAll(salonKeys, on)}
              actionLabel="Убрать из филиала"
              disabled={transferDisabled}
              onAction={() => submitBulk(salonSelected, false)}
            />
          )}
          <div className="beauty-service-items">
            {salon.map((row) => (
              <article
                className="beauty-service-item"
                draggable={canUpdate && row.active}
                key={row.id}
                onDragStart={() => { setDraggedPresetName(null); setDraggedServiceId(row.id); }}
                onDragEnd={() => setDraggedServiceId(null)}
              >
                {canUpdate && (
                  <input
                    type="checkbox"
                    className="beauty-service-check"
                    aria-label={`Выбрать: ${row.name}`}
                    checked={selected.has(`id:${row.id}`)}
                    onChange={(event) => toggle(`id:${row.id}`, event.target.checked)}
                  />
                )}
                <ServiceIdentity row={row} location />
              </article>
            ))}
            {salon.length === 0 && <p className="beauty-service-empty">Отметьте услуги в каталоге справа и нажмите «Добавить в филиал».</p>}
          </div>
        </section>

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
          {(canUpdate || canCreate) && catalogKeys.length > 0 && (
            <SelectionBar
              label="услуги каталога"
              keys={catalogKeys}
              selectedCount={catalogSelected.length}
              onToggleAll={(on) => toggleAll(catalogKeys, on)}
              actionLabel="Добавить в филиал"
              disabled={transferDisabled}
              onAction={() => submitBulk(catalogSelected, true)}
            />
          )}
          <div className="beauty-service-items">
            {catalog.map((row) => {
              const selectedInLocation = row.location?.enabled === true;
              const movable = row.active && !selectedInLocation;
              return (
                <article
                  className="beauty-service-item"
                  draggable={canUpdate && row.active}
                  key={row.id}
                  onDragStart={() => { setDraggedPresetName(null); setDraggedServiceId(row.id); }}
                  onDragEnd={() => setDraggedServiceId(null)}
                >
                  {canUpdate && (
                    <input
                      type="checkbox"
                      className="beauty-service-check"
                      aria-label={`Выбрать: ${row.name}`}
                      checked={selected.has(`id:${row.id}`)}
                      disabled={!movable}
                      onChange={(event) => toggle(`id:${row.id}`, event.target.checked)}
                    />
                  )}
                  <ServiceIdentity row={row} popularity />
                  {canUpdate && (
                    <div className="beauty-service-item-actions">
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
                    </div>
                  )}
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
                {canCreate && (
                  <input
                    type="checkbox"
                    className="beauty-service-check"
                    aria-label={`Выбрать: ${preset.name}`}
                    checked={selected.has(`preset:${preset.name}`)}
                    onChange={(event) => toggle(`preset:${preset.name}`, event.target.checked)}
                  />
                )}
                <div className="beauty-service-item-body">
                  <b>{preset.name}</b>
                  <span className="beauty-service-meta"><span>{preset.category}</span><span>{preset.minutes} мин</span></span>
                </div>
                {canCreate && <div className="beauty-service-item-actions">
                  <Button
                    type="button"
                    size="sm"
                    tone="secondary"
                    aria-label={`Настроить и добавить в филиал: ${preset.name}`}
                    onClick={() => setEditing({ mode: 'new', preset, enableForLocation: true })}
                  >
                    Настроить
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

function SelectionBar({
  label,
  keys,
  selectedCount,
  onToggleAll,
  actionLabel,
  disabled,
  onAction,
}: {
  label: string;
  keys: string[];
  selectedCount: number;
  onToggleAll: (on: boolean) => void;
  actionLabel: string;
  disabled: boolean;
  onAction: () => void;
}) {
  const all = keys.length > 0 && selectedCount === keys.length;
  return (
    <div className="beauty-service-bulk">
      <label className="beauty-check">
        <input
          type="checkbox"
          aria-label={`Выбрать все ${label}`}
          checked={all}
          onChange={(event) => onToggleAll(event.target.checked)}
        />
        {selectedCount > 0 ? `Выбрано: ${selectedCount}` : 'Выбрать все'}
      </label>
      <Button type="button" size="sm" disabled={disabled || selectedCount === 0} onClick={onAction}>
        {actionLabel}
        {selectedCount > 0 ? ` (${selectedCount})` : ''}
      </Button>
    </div>
  );
}

function ServiceIdentity({
  row,
  location = false,
  popularity = false,
}: {
  row: BeautyServiceRow;
  location?: boolean;
  popularity?: boolean;
}) {
  // Цены в списках не показываются: их правят вручную в карточке услуги. Только если у услуги филиала цена
  // ещё не задана (типовая, добавленная пачкой), строка просит её указать, чтобы запись не шла за 0.
  const minutes = location && row.effective?.sellable ? row.effective.durationMinutes : row.durationMinutes;
  const priceMissing = location && row.effective?.sellable === true && row.effective.priceMinor === '0';
  return (
    <div className="beauty-service-item-body">
      <b>{row.name}</b>
      <span className="beauty-service-meta"><span>{row.category ?? 'Без категории'}</span><span>{minutes} мин</span></span>
      {priceMissing && <small className="beauty-service-warn">Укажите цену: «Изменить» в каталоге</small>}
      {location && row.effective && !row.effective.sellable && (
        <small>{NOT_SELLABLE[row.effective.reason] ?? 'Не продаётся'}</small>
      )}
      {popularity && row.popularity && row.popularity.totalCompletedVisits > 0 && (
        <small>
          {new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(
            (row.popularity.completedVisits * 100) / row.popularity.totalCompletedVisits,
          )}
          % визитов
        </small>
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
              Категория <small className="beauty-note">необязательно: «Ногти», «Волосы»</small>
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
        {/* один живой status в диалоге: сообщение филиала ниже заменяет сообщение о создании */}
        {!error && state?.message && !locationState?.message && <p role="status">{state.message}</p>}
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
