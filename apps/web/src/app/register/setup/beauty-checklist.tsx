'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { SUPPORTED_COUNTRIES, countryOf, currencyOptions, timezoneOptions } from '@pms/domain';
import { Alert, Button, Field, Input, Select } from '../../../components/ui';
import type { SharedOnboardingState } from '../../../lib/api';
import { reloadOnboarding, saveOnboarding } from './actions';

const TITLES: Record<string, string> = {
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
const COUNTS: Record<string, string> = {
  services: 'Доступных услуг',
  masters: 'Мастеров филиала',
  skills: 'Назначений услуг',
  schedule: 'Пригодных сочетаний услуги и графика',
};
export function BeautyChecklist({ initial }: { initial: SharedOnboardingState }) {
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
  return (
    <main id="main-content" className="onboarding setup-shell" data-testid="beauty-onboarding">
      <header className="onboarding__head">
        <p>{String(state.draft.locationName ?? '')}</p>
        <h1 ref={heading} tabIndex={-1}>
          {state.currentStep === 'welcome'
            ? 'Добро пожаловать в WETOP'
            : completed && state.readiness?.ready
              ? 'Салон готов к работе'
              : 'Подготовьте салон к работе'}
        </h1>
      </header>
      {state.currentStep === 'welcome' ? (
        <section className="setup-welcome">
          <h2>Подготовим ваш салон к первой записи</h2>
          <p>
            Добавьте услуги и мастеров, свяжите их и настройте рабочее время. Остальное можно
            заполнить позже.
          </p>
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
          <p className="setup-help">
            Данные сохраняются на сервере после нажатия «Сохранить». Вы сможете продолжить с другого
            устройства.
          </p>
        </section>
      ) : !state.profileApplied ? (
        <section className="setup-profile" aria-label="Основные сведения">
          <h2>Основные сведения</h2>
          <p>
            Проверьте валюту и часовой пояс до добавления услуг. Известные данные уже заполнены.
          </p>
          <form
            className="setup-fields"
            onSubmit={(e) => {
              e.preventDefault();
              save('apply-profile');
            }}
          >
            {field('businessName', 'Название салона')}
            <p className="setup-help">
              Изменение названия салона относится ко всем филиалам этого бизнеса.
            </p>
            {field('locationName', 'Название филиала')}
            <Field label="Страна" required>
              <Select
                value={countryOf({ zone: String(draft.timezone ?? '') })?.code ?? ''}
                disabled={pending || !state.canEdit}
                onChange={(e) => {
                  const country = countryOf({ code: e.target.value });
                  if (country)
                    setDraft({ ...draft, timezone: country.zone, currency: country.currency });
                }}
              >
                {!countryOf({ zone: String(draft.timezone ?? '') }) && (
                  <option value="">Выберите страну</option>
                )}
                {SUPPORTED_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Часовой пояс">
              <Input
                readOnly
                value={
                  timezoneOptions(String(draft.timezone ?? '')).find(
                    (o) => o.value === draft.timezone,
                  )?.label ?? ''
                }
              />
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
            {state.canEdit && (
              <div className="onboarding__actions">
                <Button type="button" tone="ghost" disabled={pending} onClick={() => save('back')}>
                  Назад
                </Button>
                <Button
                  type="button"
                  tone="secondary"
                  disabled={pending}
                  onClick={() => save('save')}
                >
                  Сохранить черновик
                </Button>
                <Button type="submit" disabled={pending}>
                  Сохранить и продолжить
                </Button>
              </div>
            )}
          </form>
        </section>
      ) : (
        <section aria-label="Первые шаги">
          {completed && !state.readiness?.ready && (
            <Alert boxed>
              Настройка ранее завершена. Сейчас часть данных требует исправления. Рабочее
              пространство остаётся доступным.
            </Alert>
          )}
          <p role="status">Выполнено {done} из 4 обязательных шагов</p>
          {!state.readiness ? (
            <Alert boxed>Не удалось определить готовность. Обновите проверку.</Alert>
          ) : (
            <ol className="setup-checklist">
              {state.readiness.steps.map((step, i) => (
                <li key={step.id} className="panel">
                  <div className="setup-step-title">
                    <h2>
                      {i + 1}. {TITLES[step.id]}
                    </h2>
                    <span>
                      {step.done
                        ? 'Готово'
                        : state.permissions?.[step.id as 'services']
                          ? 'Не настроено'
                          : 'Недоступно'}
                    </span>
                  </div>
                  <p>{step.done ? `${COUNTS[step.id]}: ${step.count}` : step.reason}</p>
                  {state.permissions?.[step.id as 'services'] ? (
                    <Link className="btn btn--secondary" href={ROUTES[step.id]!}>
                      {step.done
                        ? 'Посмотреть / Изменить'
                        : step.id === 'services'
                          ? 'Добавить услугу'
                          : step.id === 'masters'
                            ? 'Добавить специалиста'
                            : step.id === 'skills'
                              ? 'Назначить услуги'
                              : 'Настроить график'}
                    </Link>
                  ) : (
                    <p>Для этого действия обратитесь к владельцу или управляющему.</p>
                  )}
                </li>
              ))}
            </ol>
          )}
          <div className="onboarding__actions">
            <Button tone="secondary" disabled={pending} onClick={() => refresh()}>
              Обновить проверку
            </Button>
            {completed && state.readiness?.ready ? (
              <Link className="btn" href="/today">
                Перейти к работе
              </Link>
            ) : (
              state.permissions?.complete && (
                <Button
                  disabled={pending || !state.readiness?.ready}
                  onClick={() => save('complete')}
                >
                  Завершить настройку
                </Button>
              )
            )}
          </div>
          {!state.readiness?.ready && (
            <p>Чтобы завершить настройку, выполните оставшиеся шаги в этом филиале.</p>
          )}
          <div className="onboarding__actions">
            <Link className="btn btn--secondary" href="/today">
              {completed && !state.readiness?.ready
                ? 'Перейти к работе'
                : 'Посмотреть рабочее пространство'}
            </Link>
            <Link className="btn btn--secondary" href="/calendar">
              Открыть календарь
            </Link>
          </div>
        </section>
      )}
      {!state.canEdit && (
        <p role="status">
          Основные сведения и завершение доступны владельцу или управляющему. Отдельные действия
          определяются вашими правами.
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
      <p role="status" aria-live="polite">
        {pending ? 'Сохраняем…' : notice}
      </p>
      <aside className="setup-help">
        <p>
          Каждый шаг отмечается готовым после серверной проверки. Сохранённые услуги и мастера
          доступны в обычных разделах.
        </p>
      </aside>
    </main>
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
