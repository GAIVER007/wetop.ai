'use client';
import {
  createContext,
  useActionState,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import { parseBranchInput, type BranchInputField } from '@pms/domain';
import { Overlay } from '../../components/overlay';
import { Icon } from '../../components/icon';
import { Alert, Button, Field, Input, Notice } from '../../components/ui';
import { switchScopeAction } from '../actions/scope';
import { createBranchAction, type BranchActionResult } from './actions';

interface Defaults {
  timezone: string;
  currency: string;
}

const EditorContext = createContext<{
  open: () => void;
  saved: string | null;
  defaults: Defaults;
} | null>(null);

/** Держит панель нового филиала вне таблицы: её открывает кнопка в шапке страницы, как «Добавить услугу» (SET3) */
export function BranchEditor({ children, defaults }: { children: ReactNode; defaults: Defaults }) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const value = useMemo(
    () => ({
      open: () => {
        setSaved(null);
        setEditing(true);
      },
      saved,
      defaults,
    }),
    [saved, defaults],
  );
  return (
    <EditorContext.Provider value={value}>
      {children}
      {saved && (
        <Notice data-testid="company-saved" role="status">
          {saved}
        </Notice>
      )}
      {editing && (
        <Overlay open drawer className="settings-service-drawer" title="Новый филиал" onClose={() => setEditing(false)}>
          <BranchForm
            defaults={defaults}
            onCancel={() => setEditing(false)}
            onSaved={(text) => {
              setSaved(text);
              setEditing(false);
            }}
          />
        </Overlay>
      )}
    </EditorContext.Provider>
  );
}

export function AddBranchButton() {
  const ctx = useContext(EditorContext);
  return (
    <Button type="button" data-testid="branch-add" onClick={() => ctx?.open()}>
      <Icon name="plus" />
      Добавить филиал
    </Button>
  );
}

/** «Открыть», тот же выбор филиала, что переключатель слева: кука и перечитанный макет */
export function OpenBranchButton({
  businessId,
  locationId,
  name,
}: {
  businessId: string;
  locationId: string;
  name: string;
}) {
  const [pending, start] = useTransition();
  return (
    <form action={(data) => start(() => switchScopeAction(data))}>
      <input type="hidden" name="scope" value={`${businessId}/${locationId}`} />
      <Button type="submit" tone="secondary" size="sm" disabled={pending} aria-busy={pending} aria-label={`Открыть филиал ${name}`}>
        {pending ? 'Открываю…' : 'Открыть'}
      </Button>
    </form>
  );
}

function BranchForm({
  defaults,
  onCancel,
  onSaved,
}: {
  defaults: Defaults;
  onCancel: () => void;
  onSaved: (text: string) => void;
}) {
  const action = (prev: BranchActionResult | null, form: FormData) => createBranchAction(prev, form, defaults);
  const [state, submit, pending] = useActionState<BranchActionResult | null, FormData>(action, null);
  // своя проверка до отправки, тем же разбором домена, что у API; причина, у поля
  const [local, setLocal] = useState<{ field?: BranchInputField | undefined; error: string } | null>(null);
  const errorId = useId();
  const reported = useRef<BranchActionResult | null>(null);
  useEffect(() => {
    if (!state?.saved || reported.current === state) return;
    reported.current = state;
    onSaved(`Филиал «${state.saved.name}» добавлен. Открыть его можно в таблице или переключателем слева.`);
  }, [state, onSaved]);
  const kept = state?.values;
  const value = (name: string, current: string) => kept?.[name] ?? current;
  const problem = local ?? (state?.error ? { field: state.field, error: state.error } : null);
  const invalid = (field: BranchInputField) =>
    problem?.field === field ? { 'aria-invalid': true, 'aria-describedby': errorId } : {};
  const fieldError = (field: BranchInputField) =>
    problem?.field === field ? <Alert id={errorId}>{problem.error}</Alert> : null;
  return (
    <form
      action={submit}
      key={state?.attempt ?? 0}
      className="company-branch-form"
      data-testid="branch-form"
      noValidate
      onSubmit={(event) => {
        const data = new FormData(event.currentTarget);
        const parsed = parseBranchInput(
          {
            name: String(data.get('name') ?? ''),
            address: String(data.get('address') ?? ''),
            phone: String(data.get('phone') ?? ''),
            email: String(data.get('email') ?? ''),
            timezone: String(data.get('timezone') ?? ''),
            currency: String(data.get('currency') ?? ''),
          },
          defaults,
        );
        if (!parsed.ok) {
          event.preventDefault();
          setLocal({ field: parsed.field, error: parsed.reason });
        } else setLocal(null);
      }}
    >
      {problem && !problem.field && <Alert boxed>{problem.error}</Alert>}
      <Field label="Название филиала">
        <Input name="name" required maxLength={200} placeholder="Например, Luxx Astana" defaultValue={value('name', '')} {...invalid('name')} />
        {fieldError('name')}
      </Field>
      <Field label="Адрес">
        <Input name="address" maxLength={500} defaultValue={value('address', '')} {...invalid('address')} />
        {fieldError('address')}
      </Field>
      <div className="company-branch-form__pair">
        <Field label="Телефон">
          <Input name="phone" inputMode="tel" defaultValue={value('phone', '')} {...invalid('phone')} />
          {fieldError('phone')}
        </Field>
        <Field label="Почта">
          <Input name="email" inputMode="email" defaultValue={value('email', '')} {...invalid('email')} />
          {fieldError('email')}
        </Field>
      </div>
      <div className="company-branch-form__pair">
        <Field label="Часовой пояс">
          <Input name="timezone" placeholder={defaults.timezone} defaultValue={value('timezone', defaults.timezone)} {...invalid('timezone')} />
          {fieldError('timezone')}
        </Field>
        <Field label="Валюта">
          <Input name="currency" maxLength={3} placeholder={defaults.currency} defaultValue={value('currency', defaults.currency)} {...invalid('currency')} />
          {fieldError('currency')}
        </Field>
      </div>
      <p className="company-note">
        У нового филиала появится свой объект без номеров и цен: после открытия стойка предложит первичную настройку.
        Заезд с 14:00 и выезд до 12:00 меняются в «Настройках объекта» филиала.
      </p>
      <div className="company-branch-form__actions">
        <Button type="button" tone="secondary" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? 'Создаю…' : 'Создать филиал'}
        </Button>
      </div>
    </form>
  );
}
