'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { SUPPORTED_COUNTRIES, countryOf, currencyOptions, timezoneOptions } from '@pms/domain';
import { Alert, Button, Field, Input, Select } from '../../../components/ui';
import type { SharedOnboardingState } from '../../../lib/api';
import { reloadOnboarding, saveOnboarding } from './actions';
import { Icon, type IconName } from '../../../components/icon';
import { setupPath, type BookingPreview, type SetupPathRow } from './setup-path';

const TITLES: Record<string, string> = {
  profile: 'Основные сведения',
  services: 'Добавьте услуги',
  masters: 'Добавьте мастера',
  skills: 'Назначьте услуги мастерам',
  schedule: 'Настройте рабочее время',
};
const ROUTES: Record<string, string> = {
  services: '/services?onboarding=1',
  masters: '/employees?onboarding=1',
  skills: '/employees?onboarding=1',
  schedule: '/beauty/schedule?onboarding=1',
};
const STEP_NAMES: Record<string, string> = {
  services: 'услуги',
  masters: 'мастера',
  skills: 'услуги мастеров',
  schedule: 'рабочее время',
};
const ACTIONS: Record<string, string> = {
  services: 'Добавить услугу',
  masters: 'Добавить специалиста',
  skills: 'Назначить услуги',
  schedule: 'Настроить график',
};
const HINTS: Record<string, string> = {
  profile: 'Название, страна и валюта: от них зависят время записей и цены.',
  services: 'Что вы делаете и сколько это стоит. Можно взять из готового списка и поправить цену.',
  masters: 'Кто принимает клиентов. Достаточно имени, остальное можно заполнить позже.',
  skills: 'Отметьте, какие услуги делает каждый мастер. Без этого к нему нельзя записаться.',
  schedule: 'Когда мастера принимают. Шаблон «Пн-Пт 10:00-19:00» в один клик.',
};
const NEXT: Array<{ href: string; icon: IconName; title: string; text: string; action: string }> = [
  { href: '/beauty-settings', icon: 'clock', title: 'Часы работы салона', text: 'Журнал и онлайн-запись показывают время только внутри этих часов.', action: 'Указать часы' },
  { href: '/marketing/site/editor', icon: 'globe', title: 'Сайт с онлайн-записью', text: 'Шаблон за минуту: услуги, мастера и цены берутся из WETOP.', action: 'Сделать сайт' },
  { href: '/employees', icon: 'guests', title: 'Вход для мастеров', text: 'Мастер видит свои записи, график, зарплату и отзывы.', action: 'Открыть персонал' },
  { href: '/payroll', icon: 'money', title: 'Оплата труда', text: 'Оклад и процент с услуг: зарплата считается сама.', action: 'Настроить зарплату' },
];
const COUNTS: Record<string, string> = {
  services: 'Доступных услуг',
  masters: 'Мастеров филиала',
  skills: 'Назначений услуг',
  schedule: 'Пригодных сочетаний услуги и графика',
};
export function BeautyChecklist({
  initial,
  preview = null,
}: {
  initial: SharedOnboardingState;
  preview?: BookingPreview | null;
}) {
  const [state, setState] = useState(initial);
  // Страна организации задаёт умолчания только для ещё не заполненного пояса (Q-SCHED-3).
  const [draft, setDraft] = useState(() => withCountry(initial.draft, initial.organizationCountry));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [latest, setLatest] = useState<SharedOnboardingState | null>(null);
  const [pending, start] = useTransition();
  const heading = useRef<HTMLHeadingElement>(null);
  const errorBox = useRef<HTMLDivElement>(null);
  const scope = `${initial.businessId}:${initial.locationId}`;
  const scopeRef = useRef(scope);
  const [changingScope, setChangingScope] = useState(false);
  useEffect(() => {
    scopeRef.current = scope;
    const changing = () => {
      scopeRef.current = '';
      setChangingScope(true);
    };
    const failed = () => {
      scopeRef.current = scope;
      setChangingScope(false);
    };
    window.addEventListener('wetop-scope-switch', changing);
    window.addEventListener('wetop-scope-switch-failed', failed);
    return () => {
      scopeRef.current = '';
      window.removeEventListener('wetop-scope-switch', changing);
      window.removeEventListener('wetop-scope-switch-failed', failed);
    };
  }, [scope]);
  useEffect(() => {
    if (error) errorBox.current?.focus();
  }, [error]);
  useEffect(() => {
    if (JSON.stringify(draft) === JSON.stringify(state.draft)) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [draft, state.draft]);

  const accept = (next: SharedOnboardingState, replaceDraft: boolean) => {
    if (scopeRef.current !== scope || `${next.businessId}:${next.locationId}` !== scope) return;
    setState(next);
    if (replaceDraft) setDraft(next.draft);
    setLatest(null);
    requestAnimationFrame(() => heading.current?.focus());
  };
  const save = (action: Parameters<typeof saveOnboarding>[0]['action']) =>
    start(async () => {
      setError(null);
      setNotice('');
      const result = await saveOnboarding({ action, draft, updatedAt: state.updatedAt });
      if (scopeRef.current !== scope) return;
      if (!result.state) {
        setError(result.error);
        return;
      }
      accept(result.state, true);
      setNotice(action === 'complete' ? 'Настройка завершена' : 'Сохранено');
    });
  const refresh = (compare = false) =>
    start(async () => {
      const result = await reloadOnboarding();
      if (scopeRef.current !== scope) return;
      if (!result.state) {
        setError(result.error);
        return;
      }
      if (`${result.state.businessId}:${result.state.locationId}` !== scope) return;
      if (compare) setLatest(result.state);
      else {
        accept(result.state, false);
        setError(null);
      }
    });
  const field = (key: string, label: string) => (
    <Field label={label} required>
      <Input
        value={String(draft[key] ?? '')}
        maxLength={200}
        disabled={pending || !state.canEdit}
        onChange={(e) => {
          setDraft({ ...draft, [key]: e.target.value });
          setNotice('Есть несохранённые изменения');
        }}
      />
    </Field>
  );
  const done = state.readiness?.steps.filter((s) => s.done).length ?? 0;
  const completed = state.completedFlowVersion === 2;
  if (changingScope)
    return (
      <main id="main-content" className="onboarding setup-shell">
        <h1>Переключаем филиал</h1>
        <p role="status">Загружаем его настройки…</p>
      </main>
    );
  const path = setupPath({
    profileApplied: Boolean(state.profileApplied),
    steps: state.readiness?.steps ?? [],
    permissions: state.permissions,
  });
  const welcome = state.currentStep === 'welcome';
  const ready = completed && Boolean(state.readiness?.ready);
  const profileForm = (
    <form
      className="setup-fields"
      aria-label="Основные сведения"
      onSubmit={(e) => {
        e.preventDefault();
        save('apply-profile');
      }}
    >
      <h3 className="sr-only">Основные сведения</h3>
      <div className="setup-fields__grid">
        {field('businessName', 'Название салона')}
        {field('locationName', 'Название филиала')}
        <Field label="Страна" required>
          <Select
            value={countryOf({ zone: String(draft.timezone ?? '') })?.code ?? ''}
            disabled={pending || !state.canEdit}
            onChange={(e) => {
              const country = countryOf({ code: e.target.value });
              if (country) setDraft({ ...draft, timezone: country.zone, currency: country.currency });
            }}
          >
            {!countryOf({ zone: String(draft.timezone ?? '') }) && <option value="">Выберите страну</option>}
            {SUPPORTED_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Валюта" required>
          <Select
            value={String(draft.currency ?? '')}
            disabled={pending || !state.canEdit}
            onChange={(e) => setDraft({ ...draft, currency: e.target.value })}
          >
            {currencyOptions(String(draft.currency ?? '')).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Часовой пояс">
          <Input
            readOnly
            value={
              timezoneOptions(String(draft.timezone ?? '')).find((o) => o.value === draft.timezone)?.label ?? ''
            }
          />
        </Field>
      </div>
      <p className="setup-help">Название салона общее для всех филиалов. Пояс и валюта задаются страной.</p>
      {state.canEdit && (
        <div className="onboarding__actions">
          <Button type="submit" disabled={pending}>
            Сохранить и продолжить
          </Button>
          <Button type="button" tone="secondary" disabled={pending} onClick={() => save('save')}>
            Сохранить черновик
          </Button>
          <Button type="button" tone="ghost" disabled={pending} onClick={() => save('back')}>
            Назад
          </Button>
        </div>
      )}
    </form>
  );
  const stepAction = (row: SetupPathRow) => {
    if (row.id === 'profile') return null;
    if (row.status === 'locked') return <p className="setup-path__note">Для этого шага нужны права владельца или управляющего.</p>;
    const href = ROUTES[row.id]!;
    if (row.status === 'done')
      return (
        <Link className="btn btn--ghost btn--sm setup-path__edit" href={href} aria-label={`Изменить: ${STEP_NAMES[row.id]}`}>
          Изменить
        </Link>
      );
    if (row.status !== 'current') return null;
    return (
      <Link className="btn" href={href}>
        {ACTIONS[row.id]}
      </Link>
    );
  };
  return (
    <main id="main-content" className="onboarding setup-shell setup-b" data-testid="beauty-onboarding">
      <header className="setup-b__head">
        <div>
          <p className="setup-b__salon">{String(state.draft.locationName ?? state.draft.businessName ?? '')}</p>
          <h1 ref={heading} tabIndex={-1}>
            {welcome ? 'Добро пожаловать в WETOP' : ready ? 'Салон готов к работе' : 'Подготовьте салон к работе'}
          </h1>
          {welcome && (
            <p className="setup-b__lead">
              Пять коротких шагов, около 5 минут. Справа видно, как клиент увидит вашу онлайн-запись.
            </p>
          )}
        </div>
        {!welcome && state.profileApplied && (
          <div className="setup-b__progress">
            <p role="status">Выполнено {done} из 4 обязательных шагов</p>
            <span className="setup-b__bar" aria-hidden="true">
              <i style={{ width: `${done * 25}%` }} /* slop-allow: inline-style ширина полосы из доли выполненных шагов */ />
            </span>
            <Button tone="ghost" size="sm" disabled={pending} onClick={() => refresh()}>
              Обновить проверку
            </Button>
          </div>
        )}
      </header>
      <div className="setup-b__grid">
        <div className="setup-b__main">
          {completed && !state.readiness?.ready && (
            <Alert boxed>
              Настройка ранее завершена. Сейчас часть данных требует исправления. Рабочее пространство остаётся
              доступным.
            </Alert>
          )}
          {state.profileApplied && !state.readiness && (
            <Alert boxed>Не удалось определить готовность. Обновите проверку.</Alert>
          )}
          <ol className="setup-path" aria-label="Шаги настройки">
            {path.map((row, i) => {
              const status = welcome ? 'todo' : row.status;
              return (
                <li key={row.id} className={`setup-path__row setup-path__row--${status}`} data-step={row.id}>
                  <span className="setup-path__num" aria-hidden="true">
                    {status === 'done' ? <Icon name="check" width={16} height={16} /> : i + 1}
                  </span>
                  <div className="setup-path__body">
                    <h2>{TITLES[row.id]}</h2>
                    <p className="setup-path__sr">
                      {status === 'done' ? 'Готово' : status === 'current' ? 'Сейчас' : status === 'locked' ? 'Недоступно' : 'Дальше'}
                    </p>
                    {status === 'done' && row.id !== 'profile' && (
                      <p className="setup-path__summary">
                        {COUNTS[row.id]}: {row.count}
                      </p>
                    )}
                    {status === 'done' && row.id === 'profile' && (
                      <p className="setup-path__summary">
                        {String(state.draft.businessName ?? '')}, {String(state.draft.currency ?? '')}
                      </p>
                    )}
                    {(status === 'current' || welcome) && <p className="setup-path__hint">{HINTS[row.id]}</p>}
                    {status === 'current' && row.id === 'profile' && !welcome && profileForm}
                  </div>
                  {!welcome && <div className="setup-path__action">{stepAction(row)}</div>}
                </li>
              );
            })}
          </ol>
          {welcome ? (
            <div className="onboarding__actions">
              {state.canEdit && (
                <Button disabled={pending} onClick={() => save('next')}>
                  {state.updatedAt ? 'Продолжить настройку' : 'Настроить салон'}
                </Button>
              )}
              <Link className="btn btn--secondary" href="/today">
                Посмотреть рабочее пространство
              </Link>
            </div>
          ) : (
            state.profileApplied && (
              <div className="onboarding__actions">
                {ready ? (
                  <>
                    <Link className="btn" href="/today">
                      Перейти к работе
                    </Link>
                    <Link className="btn btn--secondary" href="/calendar">
                      Открыть календарь
                    </Link>
                  </>
                ) : (
                  <>
                    {state.permissions?.complete && (
                      <Button disabled={pending || !state.readiness?.ready} onClick={() => save('complete')}>
                        Завершить настройку
                      </Button>
                    )}
                    <Link className="btn btn--secondary" href="/today">
                      {completed ? 'Перейти к работе' : 'Посмотреть рабочее пространство'}
                    </Link>
                    {!state.readiness?.ready && (
                      <span className="setup-b__why">Завершить можно, когда готовы все четыре шага</span>
                    )}
                  </>
                )}
              </div>
            )
          )}
          {!welcome && state.profileApplied && (
            /* полная настройка салона (решение владельца 20.10.2026): то, без чего салон не принимает клиентов сам;
               не влияет на «Завершить настройку» */
            <section aria-labelledby="setup-next-heading" className="setup-next" data-testid="beauty-setup-next">
              <h2 id="setup-next-heading">Дальше: чтобы клиенты записывались сами</h2>
              <ul className="setup-next__list">
                {NEXT.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="setup-next__item">
                      <span className="setup-next__icon" aria-hidden="true">
                        <Icon name={item.icon} width={20} height={20} />
                      </span>
                      <span>
                        <strong>{item.title}</strong>
                        <span>{item.text}</span>
                      </span>
                      <span className="setup-next__go">{item.action}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <BookingPreviewCard preview={preview} name={String(state.draft.businessName ?? '')} ready={Boolean(state.readiness?.ready)} />
      </div>
      {!state.canEdit && (
        <p role="status">
          Основные сведения и завершение доступны владельцу или управляющему. Отдельные действия определяются
          вашими правами.
        </p>
      )}
      {error && (
        <div ref={errorBox} tabIndex={-1}>
          <Alert boxed>{error}</Alert>
          <Button tone="secondary" disabled={pending} onClick={() => refresh(true)}>
            Сравнить с сохранёнными данными
          </Button>
        </div>
      )}
      {latest && (
        <section className="panel" aria-label="Сравнение данных">
          <h2>Сохранено на сервере</h2>
          <dl>
            {Object.entries(latest.draft).map(([key, value]) => (
              <div key={key}>
                <dt>
                  {{
                    businessName: 'Название салона',
                    locationName: 'Филиал',
                    currency: 'Валюта',
                    timezone: 'Часовой пояс',
                  }[key] ?? key}
                </dt>
                <dd>{String(value)}</dd>
              </div>
            ))}
          </dl>
          <p>Ваш ввод сохранён в форме. Ничего не отправлено поверх изменений другого окна.</p>
          <Button
            tone="secondary"
            onClick={() => {
              accept(latest, true);
              setError(null);
            }}
          >
            Принять сохранённые данные
          </Button>
        </section>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {pending ? 'Сохраняем…' : notice}
      </p>
    </main>
  );
}

/** Превью онлайн-записи (вариант B): что клиент увидит, по мере шагов заполняется данными салона */
function BookingPreviewCard({ preview, name, ready }: { preview: BookingPreview | null; name: string; ready: boolean }) {
  const services = preview?.services ?? [];
  const masters = preview?.masters ?? [];
  return (
    <aside className="setup-preview" aria-labelledby="setup-preview-heading" data-testid="setup-preview">
      <h2 id="setup-preview-heading">Так клиент увидит онлайн-запись</h2>
      <div className="setup-preview__phone">
        <p className="setup-preview__name">{name || 'Ваш салон'}</p>
        <div>
          <h3>Услуга</h3>
          {services.length ? (
            <ul className="setup-preview__services">
              {services.map((s) => (
                <li key={s.name}>
                  <span>
                    {s.name}
                    <small>{s.minutes} мин</small>
                  </span>
                  <b>{s.price}</b>
                </li>
              ))}
              {preview && preview.moreServices > 0 && <li className="setup-preview__more">и ещё {preview.moreServices}</li>}
            </ul>
          ) : (
            <span className="setup-preview__empty">Появится после шага «Услуги»</span>
          )}
        </div>
        <div>
          <h3>Мастер</h3>
          {masters.length ? (
            <ul className="setup-preview__masters">
              {masters.map((m) => (
                <li key={m.name} title={m.name}>
                  <span aria-hidden="true">{m.initials}</span>
                  <small>{m.name.split(' ')[0]}</small>
                </li>
              ))}
            </ul>
          ) : (
            <span className="setup-preview__empty">Появится после шага «Мастера»</span>
          )}
        </div>
        <div>
          <h3>Время</h3>
          {ready ? (
            <p className="setup-preview__ok">Свободное время считается по графику мастеров</p>
          ) : (
            <span className="setup-preview__empty">Появится после шага «Рабочие часы»</span>
          )}
        </div>
        <span className={`btn setup-preview__cta${ready ? '' : ' is-off'}`} aria-hidden="true">
          Записаться
        </span>
      </div>
      <p className="setup-preview__foot">
        {ready
          ? 'Клиенты уже могут записываться: через сайт WETOP или по ссылке.'
          : 'Превью заполняется по мере шагов слева.'}
      </p>
    </aside>
  );
}

/** Страна заполняет только отсутствующие значения; сохранённый ввод остаётся для действующей проверки. */
function withCountry(draft: Record<string, unknown>, code: string | null | undefined) {
  const country = countryOf({ code });
  // An existing timezone does not establish the organization's country/currency.
  // Preserve invalid input too: validation must reject it, not silently repair it.
  if (!country || (draft.timezone != null && draft.timezone !== '')) return draft;
  return {
    ...draft,
    timezone: country.zone,
    currency: draft.currency == null || draft.currency === '' ? country.currency : draft.currency,
  };
}
