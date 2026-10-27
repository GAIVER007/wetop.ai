'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { SUPPORTED_COUNTRIES, countryOf, currencyOptions, timezoneOptions } from '@pms/domain';
import { Alert, Button, Field, Input, Select } from '../../../components/ui';
import type { SharedOnboardingState } from '../../../lib/api';
import { reloadOnboarding, saveOnboarding } from './actions';
import { Icon, type IconName } from '../../../components/icon';
import { setupCountLine, setupPath, type BookingPreview, type SetupPathRow } from './setup-path';
import { LOCALE_NAMES, deskLocale, msg } from '../../../i18n';
import { useLocale, useT } from '../../../i18n/locale-provider';
import { OrganizationLocaleField } from '../../../components/organization-locale';

const TITLES: Record<string, string> = {
  profile: msg('Основные сведения'),
  services: msg('Добавьте услуги'),
  masters: msg('Добавьте мастера'),
  skills: msg('Назначьте услуги мастерам'),
  schedule: msg('Настройте рабочее время'),
};
const ROUTES: Record<string, string> = {
  services: '/services?onboarding=1',
  masters: '/employees?onboarding=1',
  skills: '/employees?onboarding=1',
  schedule: '/beauty/schedule?onboarding=1',
};
const STEP_NAMES: Record<string, string> = {
  services: msg('услуги'),
  masters: msg('мастера'),
  skills: msg('услуги мастеров'),
  schedule: msg('рабочее время'),
};
const ACTIONS: Record<string, string> = {
  services: msg('Добавить услугу'),
  masters: msg('Добавить специалиста'),
  skills: msg('Назначить услуги'),
  schedule: msg('Настроить график'),
};
const HINTS: Record<string, string> = {
  profile: msg('Название, страна и валюта: от них зависят время записей и цены.'),
  services: msg(
    'Что вы делаете и сколько это стоит. Можно взять из готового списка и поправить цену.',
  ),
  masters: msg('Кто принимает клиентов. Достаточно имени, остальное можно заполнить позже.'),
  skills: msg('Отметьте, какие услуги делает каждый мастер. Без этого к нему нельзя записаться.'),
  schedule: msg('Когда мастера принимают. Шаблон «Пн-Пт 10:00-19:00» в один клик.'),
};
const NEXT: Array<{ href: string; icon: IconName; title: string; text: string; action: string }> = [
  {
    href: '/beauty-settings?section=hours',
    icon: 'clock',
    title: msg('Часы работы салона'),
    text: msg('Журнал и онлайн-запись показывают время только внутри этих часов.'),
    action: msg('Указать часы'),
  },
  {
    href: '/marketing/site/editor',
    icon: 'globe',
    title: msg('Сайт с онлайн-записью'),
    text: msg('Шаблон за минуту: услуги, мастера и цены берутся из WETOP.'),
    action: msg('Сделать сайт'),
  },
  {
    href: '/employees',
    icon: 'guests',
    title: msg('Вход для мастеров'),
    text: msg('Мастер видит свои записи, график, зарплату и отзывы.'),
    action: msg('Открыть персонал'),
  },
  {
    href: '/payroll',
    icon: 'money',
    title: msg('Оплата труда'),
    text: msg('Оклад и процент с услуг: зарплата считается сама.'),
    action: msg('Настроить зарплату'),
  },
];
export function BeautyChecklist({
  initial,
  preview = null,
}: {
  initial: SharedOnboardingState;
  preview?: BookingPreview | null;
}) {
  const t = useT();
  const locale = useLocale();
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
      setNotice(action === 'complete' ? msg('Настройка завершена') : msg('Сохранено'));
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
    <Field label={t(label)} required>
      <Input
        value={String(draft[key] ?? '')}
        maxLength={200}
        disabled={pending || !state.canEdit}
        onChange={(e) => {
          setDraft({ ...draft, [key]: e.target.value });
          setNotice(msg('Есть несохранённые изменения'));
        }}
      />
    </Field>
  );
  const done = state.readiness?.steps.filter((s) => s.done).length ?? 0;
  const completed = state.completedFlowVersion === 2;
  if (changingScope)
    return (
      <main id="main-content" className="onboarding setup-shell">
        <h1>{t('Переключаем филиал')}</h1>
        <p role="status">{t('Загружаем его настройки…')}</p>
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
      aria-label={t('Основные сведения')}
      onSubmit={(e) => {
        e.preventDefault();
        save('apply-profile');
      }}
    >
      <div className="setup-fields__grid">
        {field('businessName', msg('Название салона'))}
        {field('locationName', msg('Название филиала'))}
        <Field label={t('Страна')} required>
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
              <option value="">{t('Выберите страну')}</option>
            )}
            {SUPPORTED_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {t(c.label)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('Валюта')} required>
          <Select
            value={String(draft.currency ?? '')}
            disabled={pending || !state.canEdit}
            onChange={(e) => setDraft({ ...draft, currency: e.target.value })}
          >
            {currencyOptions(String(draft.currency ?? '')).map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.label)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('Часовой пояс')}>
          <Input
            readOnly
            value={t(
              timezoneOptions(String(draft.timezone ?? '')).find((o) => o.value === draft.timezone)
                ?.label ?? '',
            )}
          />
        </Field>
      </div>
      <p className="setup-help">
        {t('Название салона общее для всех филиалов. Пояс и валюта задаются страной.')}
      </p>
      <OrganizationLocaleField
        value={state.organizationLocale ?? 'ru'}
        canEdit={Boolean(state.canEditLocale)}
      />
      {state.canEdit && (
        <div className="onboarding__actions">
          <Button type="submit" disabled={pending}>
            {t('Сохранить и продолжить')}
          </Button>
          <Button type="button" tone="secondary" disabled={pending} onClick={() => save('save')}>
            {t('Сохранить черновик')}
          </Button>
          <Button type="button" tone="ghost" disabled={pending} onClick={() => save('back')}>
            {t('Назад')}
          </Button>
        </div>
      )}
    </form>
  );
  const stepAction = (row: SetupPathRow) => {
    if (row.id === 'profile') return null;
    if (row.status === 'locked')
      return (
        <p className="setup-path__note">
          {t('Для этого шага нужны права владельца или управляющего.')}
        </p>
      );
    const href = ROUTES[row.id]!;
    if (row.status === 'done')
      return (
        <Link
          className="btn btn--ghost btn--sm setup-path__edit"
          href={href}
          aria-label={t('Изменить: {step}', { step: t(STEP_NAMES[row.id]!) })}
        >
          {t('Изменить')}
        </Link>
      );
    if (row.status !== 'current') return null;
    return (
      <Link className="btn" href={href}>
        {t(ACTIONS[row.id]!)}
      </Link>
    );
  };
  // кнопки окна: у готового салона в шапке справа (вариант B владельца 26.10.2026), иначе под шагами
  const actions = welcome ? (
    <div className="onboarding__actions">
      {/* быстрый запуск (владелец 27.10.2026): вся анкета в одном окне, одна кнопка «Создать салон» */}
      {state.canEdit && !state.profileApplied && (
        <Link className="btn" href="/register/setup/quick" data-testid="quick-start-link">
          {t('Запустить за 5 минут')}
        </Link>
      )}
      {state.canEdit && (
        <Button tone={state.profileApplied ? 'primary' : 'secondary'} disabled={pending} onClick={() => save('next')}>
          {state.updatedAt ? t('Продолжить настройку') : t('Настроить салон')}
        </Button>
      )}
      <Link className="btn btn--secondary" href="/today">
        {t('Посмотреть рабочее пространство')}
      </Link>
    </div>
  ) : (
    state.profileApplied && (
      <div className="onboarding__actions">
        {ready ? (
          <>
            <Link className="btn" href="/today">
              {t('Перейти к работе')}
            </Link>
            <Link className="btn btn--secondary" href="/calendar">
              {t('Открыть календарь')}
            </Link>
          </>
        ) : (
          <>
            {state.permissions?.complete && (
              <Button
                disabled={pending || !state.readiness?.ready}
                onClick={() => save('complete')}
              >
                {t('Завершить настройку')}
              </Button>
            )}
            <Link className="btn btn--secondary" href="/today">
              {completed ? t('Перейти к работе') : t('Посмотреть рабочее пространство')}
            </Link>
            {!state.readiness?.ready && (
              <span className="setup-b__why">
                {t('Завершить можно, когда готовы все четыре шага')}
              </span>
            )}
          </>
        )}
      </div>
    )
  );
  return (
    <main
      id="main-content"
      className="onboarding setup-shell setup-b setup-tiles"
      data-testid="beauty-onboarding"
    >
      <section className="setup-b__region" aria-label={t('Первые шаги')}>
        <header className="setup-b__head">
          <p className="setup-b__salon">
            {String(state.draft.locationName ?? state.draft.businessName ?? '')}
          </p>
          <div className="setup-b__title">
            <h1 ref={heading} tabIndex={-1}>
              {welcome
                ? t('Добро пожаловать в WETOP')
                : ready
                  ? t('Салон готов к работе')
                  : t('Подготовьте салон к работе')}
            </h1>
            {!welcome && state.profileApplied && (
              <span className={done === 4 ? 'setup-tiles__count is-done' : 'setup-tiles__count'}>
                {t('{done} из {total}', { done, total: 4 })}
              </span>
            )}
            {welcome && (
              <p className="setup-b__lead">
                {t(
                  'Пять коротких шагов, около 5 минут. Справа видно, как клиент увидит вашу онлайн-запись.',
                )}
              </p>
            )}
          </div>
          {ready && !welcome && <div className="setup-tiles__head-actions">{actions}</div>}
          {!welcome && state.profileApplied && !ready && (
            <div className="setup-b__progress">
              <p role="status">{t('Выполнено {done} из 4 обязательных шагов', { done })}</p>
              <progress className="setup-b__bar" max={4} value={done} aria-hidden="true" />
              <Button tone="ghost" size="sm" disabled={pending} onClick={() => refresh()}>
                {t('Обновить проверку')}
              </Button>
            </div>
          )}
        </header>
        <ol className="setup-path" aria-label={t('Шаги настройки')}>
          {path.map((row, i) => {
            const status = welcome ? 'todo' : row.status;
            return (
              <li
                key={row.id}
                className={`setup-path__row setup-path__row--${status}`}
                data-step={row.id}
              >
                <span className="setup-path__num" aria-hidden="true">
                  {status === 'done' ? <Icon name="check" width={16} height={16} /> : i + 1}
                </span>
                <span className="setup-tiles__step" aria-hidden="true">
                  {t('шаг {n}', { n: i + 1 })}
                </span>
                <div className="setup-path__body">
                  <h2>{t(TITLES[row.id]!)}</h2>
                  <p className="setup-path__sr">
                    {status === 'done'
                      ? t('Готово')
                      : status === 'current'
                        ? t('Сейчас')
                        : status === 'locked'
                          ? t('Недоступно')
                          : t('Дальше')}
                  </p>
                  {status === 'done' && row.id !== 'profile' && (
                    <p className="setup-path__summary">
                      {setupCountLine(row.id, row.count, locale, t)}
                    </p>
                  )}
                  {status === 'done' && row.id === 'profile' && (
                    <p className="setup-path__summary">
                      {String(state.draft.businessName ?? '')}, {String(state.draft.currency ?? '')},{' '}
                      {LOCALE_NAMES[deskLocale(state.organizationLocale)]}
                    </p>
                  )}
                  {(status === 'current' || welcome) && (
                    <p className="setup-path__hint">{t(HINTS[row.id]!)}</p>
                  )}
                  {status === 'current' && row.id === 'profile' && !welcome && profileForm}
                </div>
                {!welcome && <div className="setup-path__action">{stepAction(row)}</div>}
              </li>
            );
          })}
        </ol>
        {!(ready && !welcome) && actions}
        <div className="setup-b__grid">
          <div className="setup-b__main">
            {completed && !state.readiness?.ready && (
              <Alert boxed>
                {t(
                  'Настройка ранее завершена. Сейчас часть данных требует исправления. Рабочее пространство остаётся доступным.',
                )}
              </Alert>
            )}
            {state.profileApplied && !state.readiness && (
              <Alert boxed>{t('Не удалось определить готовность. Обновите проверку.')}</Alert>
            )}
            {!welcome && state.profileApplied && (
              /* полная настройка салона (решение владельца 20.10.2026): то, без чего салон не принимает клиентов сам;
               не влияет на «Завершить настройку» */
              <section
                aria-labelledby="setup-next-heading"
                className="setup-next"
                data-testid="beauty-setup-next"
              >
                <h2 id="setup-next-heading">{t('Дальше: чтобы клиенты записывались сами')}</h2>
                <ul className="setup-next__list">
                  {NEXT.map((item) => (
                    <li key={item.href}>
                      <Link href={item.href} className="setup-next__item">
                        <span className="setup-next__icon" aria-hidden="true">
                          <Icon name={item.icon} width={20} height={20} />
                        </span>
                        <span>
                          <strong>{t(item.title)}</strong>
                          <span>{t(item.text)}</span>
                        </span>
                        <span className="setup-next__go">{t(item.action)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
          <BookingPreviewCard
            preview={preview}
            name={String(state.draft.businessName ?? '')}
            ready={Boolean(state.readiness?.ready)}
          />
        </div>
        {!state.canEdit && (
          <p role="status">
            {t(
              'Основные сведения и завершение доступны владельцу или управляющему. Отдельные действия определяются вашими правами.',
            )}
          </p>
        )}
        {error && (
          <div ref={errorBox} tabIndex={-1}>
            <Alert boxed>{t(error)}</Alert>
            <Button tone="secondary" disabled={pending} onClick={() => refresh(true)}>
              {t('Сравнить с сохранёнными данными')}
            </Button>
          </div>
        )}
        {latest && (
          <section className="panel" aria-label={t('Сравнение данных')}>
            <h2>{t('Сохранено на сервере')}</h2>
            <dl>
              {Object.entries(latest.draft).map(([key, value]) => (
                <div key={key}>
                  <dt>
                    {t(
                      {
                        businessName: msg('Название салона'),
                        locationName: msg('Филиал'),
                        currency: msg('Валюта'),
                        timezone: msg('Часовой пояс'),
                      }[key] ?? key,
                    )}
                  </dt>
                  <dd>{String(value)}</dd>
                </div>
              ))}
            </dl>
            <p>
              {t('Ваш ввод сохранён в форме. Ничего не отправлено поверх изменений другого окна.')}
            </p>
            <Button
              tone="secondary"
              onClick={() => {
                accept(latest, true);
                setError(null);
              }}
            >
              {t('Принять сохранённые данные')}
            </Button>
          </section>
        )}
        <p className="sr-only" role="status" aria-live="polite">
          {pending ? t('Сохраняем…') : t(notice)}
        </p>
      </section>
    </main>
  );
}

/** Превью онлайн-записи (вариант B): что клиент увидит, по мере шагов заполняется данными салона */
function BookingPreviewCard({
  preview,
  name,
  ready,
}: {
  preview: BookingPreview | null;
  name: string;
  ready: boolean;
}) {
  const t = useT();
  const services = preview?.services ?? [];
  const masters = preview?.masters ?? [];
  return (
    <aside
      className="setup-preview"
      aria-labelledby="setup-preview-heading"
      data-testid="setup-preview"
    >
      <h2 id="setup-preview-heading">{t('Так клиент увидит онлайн-запись')}</h2>
      <div className="setup-preview__phone">
        <p className="setup-preview__name">{name || t('Ваш салон')}</p>
        <div>
          <h3>{t('Услуга')}</h3>
          {services.length ? (
            <ul className="setup-preview__services">
              {services.map((s) => (
                <li key={s.name}>
                  <span>
                    {s.name}
                    <small>{t('{n} мин', { n: s.minutes })}</small>
                  </span>
                  <b>{s.price}</b>
                </li>
              ))}
              {preview && preview.moreServices > 0 && (
                <li className="setup-preview__more">
                  {t('и ещё {n}', { n: preview.moreServices })}
                </li>
              )}
            </ul>
          ) : (
            <span className="setup-preview__empty">{t('Появится после шага «Услуги»')}</span>
          )}
        </div>
        <div>
          <h3>{t('Мастер')}</h3>
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
            <span className="setup-preview__empty">{t('Появится после шага «Мастера»')}</span>
          )}
        </div>
        <div>
          <h3>{t('Время')}</h3>
          {ready ? (
            <p className="setup-preview__ok">
              {t('Свободное время считается по графику мастеров')}
            </p>
          ) : (
            <span className="setup-preview__empty">{t('Появится после шага «Рабочие часы»')}</span>
          )}
        </div>
        <span className={`btn setup-preview__cta${ready ? '' : ' is-off'}`} aria-hidden="true">
          {t('Записаться')}
        </span>
      </div>
      <p className="setup-preview__foot">
        {ready
          ? t('Клиенты уже могут записываться: через сайт WETOP или по ссылке.')
          : t('Превью заполняется по мере шагов слева.')}
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
