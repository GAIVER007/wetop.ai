'use client';
import './settings.css';
import {
  createContext,
  useActionState,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { parseServiceInput, type ServiceInputField } from '@pms/domain';
import type { CatalogService } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { pluralRu } from '../../lib/plural';
import { Overlay } from '../../components/overlay';
import { Alert, Badge, Button, Field, Input, Select, Table } from '../../components/ui';
import { Icon } from '../../components/icon';
import { saveService, type ServiceActionResult } from './actions';

/**
 * «Услуги» в «Настройках объекта» (SET3, `plans/property-settings-set2-set3-2026-09-28.md`): каталог с поиском, группой и
 * статусом; новая услуга и правка — панелью справа, а не отдельной страницей. Код услуги пользователю не показывается —
 * его даёт система. Удаления нет: услуга уходит в архив, прошлые начисления хранят свою цену и название.
 */
type Editing = { mode: 'new' } | { mode: 'edit'; service: CatalogService } | null;
const EditorContext = createContext<{
  editing: Editing;
  open: (e: Editing) => void;
  groups: string[];
  setGroups: (g: string[]) => void;
  /** Что сохранили последним — строкой у счётчика, без постоянной карточки (как «Изменения сохранены» в SET1) */
  saved: string | null;
} | null>(null);

/** Держит панель услуги вне таблицы: её открывают и шапка («Добавить услугу»), и строка каталога */
export function ServiceEditor({ children, currency }: { children: ReactNode; currency: string }) {
  const [editing, setEditing] = useState<Editing>(null);
  const [groups, setGroups] = useState<string[]>([]);
  const [saved, setSaved] = useState<string | null>(null);
  const value = useMemo(
    () => ({
      editing,
      open: (e: Editing) => {
        setSaved(null);
        setEditing(e);
      },
      groups,
      setGroups,
      saved,
    }),
    [editing, groups, saved],
  );
  return (
    <EditorContext.Provider value={value}>
      {children}
      {editing && (
        <Overlay
          open
          drawer
          className="settings-service-drawer"
          title={editing.mode === 'new' ? 'Новая услуга' : editing.service.name}
          onClose={() => setEditing(null)}
        >
          <ServiceForm
            key={editing.mode === 'edit' ? editing.service.code : 'new'}
            service={editing.mode === 'edit' ? editing.service : null}
            groups={groups}
            currency={currency}
            onCancel={() => setEditing(null)}
            onSaved={(text) => {
              setSaved(text);
              setEditing(null);
            }}
          />
        </Overlay>
      )}
    </EditorContext.Provider>
  );
}

export function AddServiceButton() {
  const ctx = useContext(EditorContext);
  return (
    <Button type="button" data-testid="service-add" onClick={() => ctx?.open({ mode: 'new' })}>
      <Icon name="plus" />
      Добавить услугу
    </Button>
  );
}

const matches = (query: string, values: Array<string | null>) =>
  values
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('ru')
    .includes(query.trim().toLocaleLowerCase('ru'));
const NO_GROUP = '__none';

export function ServicesCatalog({
  services,
  currency,
  editable,
}: {
  services: CatalogService[];
  currency: string;
  editable: boolean;
}) {
  const ctx = useContext(EditorContext);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('all');
  const [status, setStatus] = useState<'active' | 'archived' | 'all'>('active');
  const groups = useMemo(
    () =>
      [...new Set(services.map((s) => s.group).filter((g): g is string => !!g))].sort((a, b) =>
        a.localeCompare(b, 'ru'),
      ),
    [services],
  );
  const setGroups = ctx?.setGroups;
  useEffect(() => setGroups?.(groups), [setGroups, groups]);
  const rows = services.filter(
    (s) =>
      matches(query, [s.name, s.group]) &&
      (group === 'all' || (group === NO_GROUP ? !s.group : s.group === group)) &&
      (status === 'all' || s.active === (status === 'active')),
  );
  const filtered = query !== '' || group !== 'all' || status !== 'active';
  return (
    <section className="settings-catalog" aria-label="Каталог услуг">
      <div className="settings-toolbar">
        <Field label="Найти услугу">
          <Input
            type="search"
            placeholder="Название или группа"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </Field>
        <Field label="Группа">
          <Select value={group} onChange={(event) => setGroup(event.target.value)}>
            <option value="all">Все группы</option>
            {groups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
            <option value={NO_GROUP}>Без группы</option>
          </Select>
        </Field>
        <Field label="Статус">
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
          >
            <option value="active">Активные</option>
            <option value="archived">В архиве</option>
            <option value="all">Все</option>
          </Select>
        </Field>
        <span className="settings-count" data-testid="services-count">
          {pluralRu(rows.length, ['услуга', 'услуги', 'услуг'])}
        </span>
        <span
          className="settings-save-state settings-save-state--saved"
          role="status"
          data-testid="service-saved"
        >
          {ctx?.saved ? `✓ ${ctx.saved}` : ''}
        </span>
        {filtered && (
          <Button
            tone="ghost"
            onClick={() => {
              setQuery('');
              setGroup('all');
              setStatus('active');
            }}
          >
            Сбросить отбор
          </Button>
        )}
      </div>
      <Table data-testid="services-table" className="settings-table settings-table--services">
        <thead>
          <tr>
            <th>Услуга</th>
            <th className="settings-col-wide">Группа</th>
            <th className="num">Цена</th>
            <th className="settings-col-wide">Статус</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.code} className={s.active ? undefined : 'is-archived'}>
              <td>
                {editable ? (
                  <button
                    type="button"
                    className="settings-service-name"
                    onClick={() => ctx?.open({ mode: 'edit', service: s })}
                  >
                    {s.name}
                  </button>
                ) : (
                  s.name
                )}
                {/* на телефоне колонки группы и статуса скрыты — то же строкой под названием */}
                {(s.group || !s.active) && (
                  <span className="cell-sub settings-service-sub">
                    {s.group && <span>{s.group}</span>}
                    {!s.active && <Badge tone="neutral">в архиве</Badge>}
                  </span>
                )}
              </td>
              <td className="settings-col-wide">{s.group ?? '—'}</td>
              <td className="num">{formatMoney(s.priceMinor, currency)}</td>
              <td className="settings-col-wide">
                <Badge tone={s.active ? 'ok' : 'neutral'}>
                  {s.active ? 'активна' : 'в архиве'}
                </Badge>
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td
                colSpan={4}
                className="empty-state"
                data-testid={services.length ? 'services-no-results' : 'services-empty'}
              >
                {services.length
                  ? 'Ничего не найдено. Измените отбор или сбросьте его.'
                  : 'Услуг в каталоге пока нет.'}
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </section>
  );
}

/** Цена тиынами → как в поле: «700», «700,50» */
const priceField = (minor: string) => {
  const v = BigInt(minor);
  const kopecks = v % 100n;
  return kopecks === 0n
    ? (v / 100n).toString()
    : `${v / 100n},${kopecks.toString().padStart(2, '0')}`;
};

function ServiceForm({
  service,
  groups,
  currency,
  onCancel,
  onSaved,
}: {
  service: CatalogService | null;
  groups: string[];
  currency: string;
  onCancel: () => void;
  onSaved: (text: string) => void;
}) {
  const [state, action, pending] = useActionState<ServiceActionResult | null, FormData>(
    saveService,
    null,
  );
  // своя проверка до отправки — тем же разбором домена, что у API; причина — у поля
  const [local, setLocal] = useState<{
    field?: ServiceInputField | undefined;
    error: string;
  } | null>(null);
  const listId = useId();
  const errorId = useId();
  // ответ API приходит один раз, а родитель перерисовывается и после revalidatePath — сообщаем об успехе ровно раз
  const reported = useRef<ServiceActionResult | null>(null);
  useEffect(() => {
    if (!state?.saved || reported.current === state) return;
    reported.current = state;
    onSaved(
      service ? `Услуга «${state.saved.name}» сохранена` : `Услуга «${state.saved.name}» добавлена`,
    );
  }, [state, service, onSaved]);
  const kept = state?.values;
  const value = (name: string, current: string) => kept?.[name] ?? current;
  const problem = local ?? (state?.error ? { field: state.field, error: state.error } : null);
  const invalid = (field: ServiceInputField) =>
    problem?.field === field ? { 'aria-invalid': true, 'aria-describedby': errorId } : {};
  const fieldError = (field: ServiceInputField) =>
    problem?.field === field ? <Alert id={errorId}>{problem.error}</Alert> : null;
  return (
    <form
      action={action}
      key={state?.attempt ?? 0}
      className="settings-service-form"
      data-testid="service-form"
      noValidate
      onSubmit={(event) => {
        const data = new FormData(event.currentTarget);
        const parsed = parseServiceInput({
          name: String(data.get('name') ?? ''),
          group: String(data.get('group') ?? '').trim() || null,
          price: String(data.get('price') ?? ''),
          active: String(data.get('active') ?? 'true') === 'true',
        });
        if (!parsed.ok) {
          event.preventDefault();
          setLocal({ field: parsed.field, error: parsed.reason });
        } else setLocal(null);
      }}
    >
      {service && <input type="hidden" name="code" value={service.code} />}
      {problem && !problem.field && <Alert boxed>{problem.error}</Alert>}
      <Field label="Название">
        <Input
          name="name"
          required
          maxLength={200}
          defaultValue={value('name', service?.name ?? '')}
          {...invalid('name')}
        />
        {fieldError('name')}
      </Field>
      <Field label="Группа">
        <Input
          name="group"
          list={listId}
          maxLength={100}
          placeholder="Например, Минибар"
          defaultValue={value('group', service?.group ?? '')}
          {...invalid('group')}
        />
        {fieldError('group')}
      </Field>
      <datalist id={listId}>
        {groups.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>
      <Field label={`Цена, ${currency === 'KZT' ? '₸' : currency}`}>
        <Input
          name="price"
          inputMode="decimal"
          required
          placeholder="700"
          defaultValue={value('price', service ? priceField(service.priceMinor) : '')}
          {...invalid('price')}
        />
        {fieldError('price')}
      </Field>
      <Field label="Статус">
        <Select
          name="active"
          defaultValue={value('active', String(service?.active ?? true))}
          {...invalid('active')}
        >
          <option value="true">Активна</option>
          <option value="false">В архиве</option>
        </Select>
        {fieldError('active')}
      </Field>
      <p className="settings-note">
        {service
          ? 'Новая цена и название — для следующих начислений; уже выставленные счета не меняются. Услугу в архиве нельзя выбрать в счёте.'
          : 'Услугу можно будет выбрать в счёте гостя сразу после сохранения.'}
      </p>
      <div className="settings-service-actions">
        <Button type="button" tone="secondary" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? 'Сохраняю…' : service ? 'Сохранить' : 'Создать'}
        </Button>
      </div>
    </form>
  );
}
