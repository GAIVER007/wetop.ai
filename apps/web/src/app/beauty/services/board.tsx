'use client';
import { startTransition, useActionState, useEffect, useRef, useState } from 'react';
import { currencyOptions, parseBeautyServiceInput, parseLocationServiceInput } from '@pms/domain';
import { Overlay } from '../../../components/overlay';
import { Alert, Button, Field, Input, Select } from '../../../components/ui';
import { Icon } from '../../../components/icon';
import { formatMoney } from '../../../lib/money';
import { categoryTone, popularityPercent, servicesSummary, shownPriceMinor } from './price-list';
import { inputToMinor, minorToInput } from '../../../lib/money';
import type { BeautyServiceRow } from '../../../lib/api';
import { pendingCreation, useCreationKey } from '../creation-key';
import { moveLocationServices, saveBeautyService, saveLocationService } from '../actions';
import { PRESETS, type ServicePreset } from './presets';
import { ServiceMaterials } from './materials';
import { closesAfterSave, serviceFieldErrors, type ServiceFieldErrors } from './service-validation';
import { useToast } from '../../../components/toast';
import './services.css';
import { groupCatalog } from '../../../components/catalog-table';
import { msg } from '../../../i18n';
import { useLocale, useT } from '../../../i18n/locale-provider';
import { countLabel } from '../../../i18n';

/**
 * Каталог услуг салона (DATA_MODEL §19.1, срез B3). Каталог принадлежит сети, цену и доступность решает
 * филиал: поэтому в строке две цены, каталога и филиала, и видно, что услуга в этом филиале не продаётся.
 * Вид прайс-листа (вариант B, выбор владельца 25.10.2026): одна таблица по категориям, цена и доля визитов в строке,
 * «В филиале» выключателем, перенос пачкой галочками остаётся.
 */
const NOT_SELLABLE: Record<string, string> = {
  SERVICE_INACTIVE: msg('В архиве'),
  NOT_ENABLED: msg('Филиал не оказывает'),
  CURRENCY_MISMATCH: msg('Нужна цена филиала: валюта каталога другая'),
};

type Editing =
  | { mode: 'new'; preset?: ServicePreset; enableForLocation?: boolean }
  | { mode: 'edit'; row: BeautyServiceRow }
  | null;

/**
 * Категории по алфавиту, «Без категории» последней (решение владельца 23.10.2026, п. 6). Цены в списке снова видны:
 * прайс-лист, вариант B (25.10.2026) заменил «список без цен» PR 749.
 */
function byCategory<T>(rows: readonly T[], categoryOf: (row: T) => string | null | undefined) {
  const names = [...new Set(rows.map((row) => categoryOf(row)?.trim()).filter((c): c is string => Boolean(c)))].sort(
    (a, b) => a.localeCompare(b, 'ru-RU'),
  );
  return groupCatalog(rows, (row) => categoryOf(row)?.trim() || null, names.map((name) => ({ id: name, name })));
}

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
  const t = useT();
  const locale = useLocale();
  const [editing, setEditing] = useState<Editing>(null);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [materialService, setMaterialService] = useState<BeautyServiceRow | null>(null);
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
  const busy = bulkPending;
  const transferDisabled = busy || !locationCurrency;

  // Что можно отметить: слева услуги филиала, справа то, чего в филиале ещё нет (включая типовые)
  const salonKeys = salon.map((row) => `id:${row.id}`);
  const catalogKeys = [
    ...catalog.filter((row) => row.active && row.location?.enabled !== true).map((row) => `id:${row.id}`),
    ...presetCatalog.map((preset) => `preset:${preset.name}`),
  ];
  const toggle = (key: string, on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(key);
      else next.delete(key);
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
    const id = pendingCreation(scopeKey, 'service');
    const row = items.find((item) => item.id === id);
    if (row) setEditing((current) => current === null ? { mode: 'edit', row } : current);
  }, [scopeKey, items]);
  const summary = servicesSummary(items);
  const chosenAdd = catalogKeys.filter((key) => selected.has(key));
  const chosenRemove = salonKeys.filter((key) => selected.has(key));
  const maxPopularity = Math.max(0, ...salon.map((r) => popularityPercent(r) ?? 0));
  const pctText = (pct: number | null) =>
    pct === null ? '' : `${new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'ru-RU', { maximumFractionDigits: 1 }).format(pct)} %`;
  const missing = catalog.filter((row) => row.location?.enabled !== true);
  const serviceRow = (row: BeautyServiceRow, side: 'location' | 'catalog') => {
    const key = `id:${row.id}`;
    const price = shownPriceMinor(row);
    const minutes = side === 'location' && row.effective?.sellable ? row.effective.durationMinutes : row.durationMinutes;
    const reason = row.effective && !row.effective.sellable && row.effective.reason !== 'NOT_ENABLED' ? row.effective.reason : null;
    const pct = side === 'location' && maxPopularity > 0 ? popularityPercent(row) : null;
    return (
      <li key={row.id} className={`beauty-service-item${side === 'location' ? ' is-on' : ''}${row.active ? '' : ' is-archived'}`} data-service-in-location={side === 'location' ? 'true' : 'false'}>
        {canUpdate ? (
          <input
            type="checkbox"
            className="beauty-service-check"
            aria-label={t('Выбрать: {name}', { name: row.name })}
            checked={selected.has(key)}
            disabled={!row.active}
            onChange={(event) => toggle(key, event.target.checked)}
          />
        ) : <span aria-hidden="true" />}
        <span className="beauty-service-row__name">
          <b>{row.name}</b>
          {reason && <small>{NOT_SELLABLE[reason] ? t(NOT_SELLABLE[reason]!) : t('Не продаётся')}</small>}
          {!row.active && <small>{t('В архиве')}</small>}
        </span>
        <span className="beauty-service-row__time">{t('{minutes} мин', { minutes })}</span>
        <span className="beauty-service-row__price">
          {price === '0'
            ? <span className="beauty-service-warn">{t('Укажите цену')}</span>
            : <b>{formatMoney(price, row.effective?.sellable ? row.effective.currency : row.currency)}</b>}
        </span>
        <span className="beauty-service-row__pct" title={t('Доля завершённых визитов')}>{pctText(pct)}</span>
        <span className="beauty-service-row__actions">
          {canUpdate && side === 'location' && (
            <>
              <button type="button" className="icon-button" aria-label={t('Техкарта услуги: {name}', { name: row.name })} onClick={() => setMaterialService(row)}><Icon name="product" /></button>
              <button type="button" className="icon-button" aria-label={t('Изменить: {name}', { name: row.name })} onClick={() => setEditing({ mode: 'edit', row })}><Icon name="edit" /></button>
            </>
          )}
          {canUpdate && side === 'catalog' && (
            <button type="button" className="icon-button" aria-label={t('Изменить: {name}', { name: row.name })} onClick={() => setEditing({ mode: 'edit', row })}><Icon name="edit" /></button>
          )}
        </span>
      </li>
    );
  };
  const groups = (rows: BeautyServiceRow[], side: 'location' | 'catalog') =>
    byCategory(rows, (r) => r.category).map((group) => (
      <div key={`${side}:${group.key}`} className={`beauty-service-cat beauty-tone-${categoryTone(group.key === null ? null : group.name)}`}>
        <h3>
          <span className="beauty-price-dot" aria-hidden="true" />
          <span className="beauty-service-group">{group.key ? group.name : t(group.name)} </span>
          <span className="beauty-price-group__meta">{group.rows.length}</span>
        </h3>
        <ul>{group.rows.map((r) => serviceRow(r, side))}</ul>
      </div>
    ));
  return (
    <>
      {/* две колонки со стрелками (владелец 30.10.2026, макет): слева филиал, справа что добавить */}
      <div className="beauty-service-dual-toolbar">
        <Input type="search" aria-label={t('Поиск услуг')} placeholder={t('Поиск: название или категория')} value={search} onChange={event => setSearch(event.target.value)} />
        <label className="beauty-check beauty-service-archive-filter">
          <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />
          {t('Показать архив')}{archivedCount > 0 ? ` (${archivedCount})` : ''}
        </label>
        {canCreate && (
          <Button type="button" onClick={() => setEditing({ mode: 'new', enableForLocation: Boolean(locationCurrency) })}>
            {t('Добавить услугу')}
          </Button>
        )}
      </div>
      {!locationCurrency && <Alert>{t('Выберите филиал, чтобы добавлять и убирать его услуги.')}</Alert>}
      {notice?.error && <Alert>{notice.error}</Alert>}
      {!notice?.error && notice?.message && <p role="status">{notice.message}</p>}
      <div className="beauty-service-columns" data-service-list="price">
        <section className="beauty-service-col" data-service-column="location" aria-label={t('В филиале')}>
          <header>
            <h2>{t('В филиале')}</h2>
            <small>
              {countLabel(locale, t, salon.length, [msg('услуга'), 'услуги', msg('услуг')])} {/* kk-allow: форма склонения */}
              {summary.averageMinor ? `, ${t('средняя {price}', { price: formatMoney(summary.averageMinor, locationCurrency ?? 'KZT') })}` : ''}
            </small>
          </header>
          {salon.length ? groups(salon, 'location') : (
            <p className="beauty-service-empty">{t('В филиале пока нет услуг. Отметьте справа и нажмите ←.')}</p>
          )}
        </section>
        {canUpdate && (
          <div className="beauty-service-arrows">
            <button
              type="button"
              className="beauty-service-arrow"
              aria-label={t('Добавить в филиал отмеченные')}
              title={t('Добавить в филиал')}
              disabled={transferDisabled || chosenAdd.length === 0}
              onClick={() => submitBulk(chosenAdd, true)}
            >←</button>
            <button
              type="button"
              className="beauty-service-arrow"
              aria-label={t('Убрать из филиала отмеченные')}
              title={t('Убрать из филиала')}
              disabled={transferDisabled || chosenRemove.length === 0}
              onClick={() => submitBulk(chosenRemove, false)}
            >→</button>
          </div>
        )}
        <section className="beauty-service-col" data-service-column="catalog" aria-label={t('Можно добавить')}>
          <header>
            <h2>{t('Можно добавить')}</h2>
            <small>{t('каталог сети, {n}', { n: missing.length + presetCatalog.length })}</small>
          </header>
          {groups(missing, 'catalog')}
          {presetCatalog.length > 0 && (
            <div className="beauty-service-cat beauty-tone-0">
              <h3>
                <span className="beauty-price-dot" aria-hidden="true" />
                <span className="beauty-service-group">{t('Типовые услуги')} </span>
                <span className="beauty-price-group__meta">{t('цена задаётся при добавлении')}</span>
              </h3>
              <ul>
                {presetCatalog.map((preset) => (
                  <li className="beauty-service-item beauty-service-item--preset" key={`preset:${preset.name}`}>
                    {canCreate ? (
                      <input
                        type="checkbox"
                        className="beauty-service-check"
                        aria-label={t('Выбрать: {name}', { name: preset.name })}
                        checked={selected.has(`preset:${preset.name}`)}
                        onChange={(event) => toggle(`preset:${preset.name}`, event.target.checked)}
                      />
                    ) : <span aria-hidden="true" />}
                    <span className="beauty-service-row__name"><b>{preset.name}</b><small>{t(preset.category)}</small></span>
                    <span className="beauty-service-row__time">{t('{minutes} мин', { minutes: preset.minutes })}</span>
                    <span className="beauty-service-row__price"><span className="beauty-price-muted">—</span></span>
                    <span className="beauty-service-row__pct" />
                    <span className="beauty-service-row__actions">
                      {canCreate && (
                        <button type="button" className="icon-button" aria-label={t('Настроить и добавить в филиал: {name}', { name: preset.name })} onClick={() => setEditing({ mode: 'new', preset, enableForLocation: true })}><Icon name="edit" /></button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {missing.length === 0 && presetCatalog.length === 0 && (
            <p className="beauty-service-empty">{t('Все услуги сети уже в филиале.')}</p>
          )}
          {canUpdate && (missing.length > 0 || presetCatalog.length > 0) && (
            <p className="beauty-service-hint">{t('Отметьте галочками и нажмите ←, чтобы добавить в филиал')}</p>
          )}
        </section>
      </div>
      <Overlay
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.mode === 'edit' ? t('Услуга каталога') : editing?.mode === 'new' && editing.preset ? t('Настройка типовой услуги') : t('Новая услуга')}
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
            onCreated={() => setEditing(null)}
          />
        )}
      </Overlay>
      <Overlay
        open={materialService !== null}
        onClose={() => setMaterialService(null)}
        title={materialService ? t('Техкарта: {name}', { name: materialService.name }) : t('Техкарта услуги')}
        drawer
      >
        {materialService && (
          <ServiceMaterials
            key={materialService.id}
            serviceId={materialService.id}
            serviceName={materialService.name}
            scopeKey={scopeKey}
            priceMinor={materialService.priceMinor}
          />
        )}
      </Overlay>
    </>
  );
}

function ServiceForm({
  row,
  preset,
  enableForLocation = false,
  locationCurrency,
  scopeKey,
  canDelete,
  onCreated,
}: {
  scopeKey: string;
  row: BeautyServiceRow | null;
  preset?: ServicePreset;
  enableForLocation?: boolean;
  locationCurrency: string | null;
  canDelete: boolean;
  /** новая услуга создана и включена в филиале: окно закрывается (аудит салона 22.10.2026) */
  onCreated?: () => void;
}) {
  const t = useT();
  const { toast } = useToast();
  const [fieldErrors, setFieldErrors] = useState<ServiceFieldErrors>({});
  const creation = useCreationKey(scopeKey, 'service', Boolean(row));
  const [enableHere, setEnableHere] = useState(enableForLocation);
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
    if (closesAfterSave(state, Boolean(row))) {
      creation.clear();
      toast({ text: `${state?.message}: ${submittedDraft.current.name}`, tone: 'success' });
      onCreated?.();
    }
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
        noValidate
        onSubmit={(event) => {
          submittedDraft.current = { ...draft };
          const data = new FormData(event.currentTarget);
          // свои сообщения под полями вместо молчания и английских подсказок браузера (аудит 22.10.2026)
          const errors = serviceFieldErrors(draft);
          setFieldErrors(errors);
          if (Object.keys(errors).length) {
            event.preventDefault();
            setError(null);
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
        {/* новая услуга сразу продаётся в филиале, из которого её создали (аудит 21.10.2026 п.5) */}
        {!row && locationCurrency && (
          <label className="beauty-check">
            <input
              type="checkbox"
              name="enableForLocation"
              value="on"
              checked={enableHere}
              onChange={(e) => setEnableHere(e.target.checked)}
            />
            {t('Сразу в этом филиале')}
          </label>
        )}
        <input type="hidden" name="priceMinor" value={priceMinor ?? ''} />
        {/* у «Добавить» типовой услуги выбор уже сделан: второй список из 14 услуг не показываем (п.22) */}
        {!row && !preset && (
          <Field label={t('Типовая услуга')}>
            <Select
              aria-label={t('Типовая услуга')}
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
              <option value="">{t('Выбрать из списка или ввести своё ниже')}</option>
              {PRESETS.map((p) => (
                <option key={p.name} value={p.name}>
                  {t('{name}, {minutes} мин', { name: p.name, minutes: p.minutes })}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label={t('Название')} controlId="service-name" error={fieldErrors.name && t(fieldErrors.name)}>
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
              {t('Категория')} <small className="beauty-note">{t('необязательно: «Ногти», «Волосы»')}</small>
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
        <Field label={t('Длительность, минут')} controlId="service-duration" error={fieldErrors.durationMinutes && t(fieldErrors.durationMinutes)}>
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
              {t('Цена каталога, {currency}', { currency: draft.currency })}{' '}
              <small className="beauty-note">{t('например 5000')}</small>
            </span>
          }
          controlId="service-price"
          error={fieldErrors.price && t(fieldErrors.price)}
        >
          <Input
            inputMode="decimal"
            required
            value={draft.price}
            onChange={(e) => setDraft({ ...draft, price: e.target.value })}
          />
        </Field>
        <Field label={t('Валюта цены каталога')}>
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
          {t('Услуга активна')}
        </label>
        {(creation.error || error || state?.error) && (
          <Alert>{creation.error || error || state?.error}</Alert>
        )}
        {/* один живой status в диалоге: сообщение филиала ниже заменяет сообщение о создании */}
        {!error && state?.message && !locationState?.message && <p role="status">{state.message}</p>}
        <Button type="submit" disabled={pending || (!row && !creation.id)}>
          {pending ? t('Сохраняем…') : t('Сохранить услугу')}
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
              setLocationError(t('Своя цена: число, например 5000, или пусто'));
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
          <h3>{t('В этом филиале')}</h3>
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
            {t('Филиал оказывает эту услугу')}
          </label>
          <Field
            label={
              <span>
                {t('Своя цена филиала, {currency}', { currency: locationCurrency ?? draft.currency })}{' '}
                <small className="beauty-note">{t('пусто: действует цена каталога')}</small>
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
                {t('Своя длительность, минут')}{' '}
                <small className="beauty-note">{t('пусто: действует длительность каталога')}</small>
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
            {locationPending ? t('Сохраняем…') : t('Сохранить для филиала')}
          </Button>
        </form>
      )}
    </>
  );
}
