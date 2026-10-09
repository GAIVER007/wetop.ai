'use client';
import { useId, useMemo, useState, useTransition } from 'react';
import {
  DEFAULT_PHONE_COUNTRY,
  CREATE_VERTICAL_LABEL,
  CREATE_VERTICALS,
  PHONE_COUNTRIES,
  REGION_COUNTRIES,
  REGION_CURRENCIES,
  REGION_TIMEZONE_OPTIONS,
  parseOrganizationCreate,
  regionCountry,
  timezoneLabel,
  type CreateVertical,
} from '@pms/domain';
import { Overlay } from '../../components/overlay';
import { Icon, type IconName } from '../../components/icon';
import { Alert, Button, Field, Input, Select } from '../../components/ui';
import { FormGrid } from '../../components/form-grid';
import { createOrganizationAction, type CreateOrganizationResult } from './actions';
import './organizations.css';

/**
 * Окно «Создать организацию»: три шага (организация, первый филиал, подтверждение). Всё вводится в одном состоянии и
 * уходит одним запросом на последнем шаге: черновиков нет, до подтверждения на сервере ничего не появляется. Проверка
 * полей здесь для удобства, решает API.
 */
const VERTICAL_ICON: Record<CreateVertical, IconName> = {
  HOSPITALITY: 'inventory',
  BEAUTY: 'salon',
  FOOD_SERVICE: 'restaurant',
};

const STEPS = ['Организация', 'Первый филиал', 'Подтверждение'] as const;

interface Form {
  name: string;
  brand: string;
  vertical: CreateVertical;
  ownerName: string;
  phoneCountry: string;
  ownerPhone: string;
  ownerEmail: string;
  country: string;
  city: string;
  timezone: string;
  currency: string;
  bin: string;
  website: string;
  createFirstBranch: boolean;
  branchName: string;
  branchAddress: string;
}

const initial = (): Form => ({
  name: '',
  brand: '',
  vertical: 'HOSPITALITY',
  ownerName: '',
  phoneCountry: DEFAULT_PHONE_COUNTRY,
  ownerPhone: '',
  ownerEmail: '',
  country: REGION_COUNTRIES[0]!.code,
  city: REGION_COUNTRIES[0]!.cities[0]!.name,
  timezone: REGION_COUNTRIES[0]!.cities[0]!.timezone,
  currency: REGION_COUNTRIES[0]!.currency,
  bin: '',
  website: '',
  createFirstBranch: true,
  branchName: '',
  branchAddress: '',
});

type Errors = Partial<Record<keyof Form, string>>;

/** Ошибки полей шага: тексты те же, что у API (`parseOrganizationCreate`), разобранные по полям */
function stepErrors(form: Form, step: 0 | 1): Errors {
  const parsed = parseOrganizationCreate({ ...form, id: '5d2f1a9e-8c7b-4e3a-a1f0-6b9c2d4e8f00' });
  if (parsed.ok) return {};
  const byField: Array<[keyof Form, RegExp, 0 | 1]> = [
    ['name', /^Название организации/, 0],
    ['brand', /^Публичное название/, 0],
    ['vertical', /направление/, 0],
    ['ownerName', /^Имя владельца/, 0],
    ['ownerEmail', /^Почта владельца/, 0],
    ['ownerPhone', /^Телефон/, 0],
    ['country', /страну/, 0],
    ['city', /город/, 0],
    ['timezone', /часовой пояс/, 0],
    ['currency', /валюту/, 0],
    ['bin', /^БИН/, 0],
    ['website', /^Сайт/, 0],
    ['branchName', /^Название филиала/, 1],
    ['branchAddress', /^Адрес филиала/, 1],
  ];
  const out: Errors = {};
  for (const message of parsed.errors) {
    const hit = byField.find(([, re]) => re.test(message));
    if (hit && hit[2] === step) out[hit[0]] = message;
  }
  return out;
}

export function CreateOrganization() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [form, setForm] = useState<Form>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [result, setResult] = useState<CreateOrganizationResult | null>(null);
  const [pending, start] = useTransition();
  // один запрос на открытие окна: двойное нажатие и повтор после обрыва возвращают то же, а не дубль
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const uid = useId();
  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    // правка поля снимает его ошибку: она относилась к прежнему вводу
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };
  const region = regionCountry(form.country);
  const cityOptions = region?.cities ?? [];

  const close = () => {
    setOpen(false);
    if (result?.ok) {
      setStep(0);
      setForm(initial());
      setResult(null);
      setRequestId(crypto.randomUUID());
    }
  };

  const next = () => {
    if (step === 2) return;
    const found = stepErrors(form, step);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setStep((step + 1) as 1 | 2);
  };

  const submit = () => {
    start(async () => {
      const outcome = await createOrganizationAction({ ...form, id: requestId });
      setResult(outcome);
    });
  };

  const summary = useMemo(
    () => ({
      branch: form.createFirstBranch ? form.branchName.trim() || form.brand.trim() : null,
      zone: timezoneLabel(form.timezone, form.city),
    }),
    [form.createFirstBranch, form.branchName, form.brand, form.timezone, form.city],
  );

  const created = result?.ok ? result : null;
  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} data-testid="create-organization-open">
        <Icon name="plus" width={16} height={16} /> Создать организацию
      </Button>
      <Overlay open={open} onClose={close} title="Создать организацию" size="lg" className="org-create" trapFocus>
        {created ? (
          <section className="org-create__done" data-testid="create-organization-done">
            <Icon name="check" width={32} height={32} />
            <h3>{created.replay ? 'Организация уже создана' : 'Организация создана'}</h3>
            <p>
              Доступ владельца открыт на {form.ownerEmail.trim().toLowerCase()}.{' '}
              {created.mailSent === true && 'На эту почту отправлено письмо со ссылкой, где владелец задаёт пароль.'}
              {created.mailSent === false &&
                'Письмо не ушло: попросите владельца нажать «Забыли пароль» на странице входа.'}
              {created.mailSent === null &&
                'Такая учётная запись уже была в WETOP: владелец увидит новую организацию при входе.'}
            </p>
            <Button type="button" onClick={close}>
              Готово
            </Button>
          </section>
        ) : (
          <div className="org-create__layout">
            <ol className="org-create__steps" aria-label="Шаги">
              {STEPS.map((label, i) => (
                <li key={label} aria-current={i === step ? 'step' : undefined} data-done={i < step || undefined}>
                  <span className="org-create__num" aria-hidden="true">
                    {i < step ? '✓' : i + 1}
                  </span>
                  {label}
                </li>
              ))}
            </ol>
            <div className="org-create__body">
              {step === 0 && (
                <>
                  <fieldset className="org-create__section">
                    <legend>
                      <span className="org-create__badge">1</span> Основная информация
                    </legend>
                    <FormGrid columns={2}>
                      <Field label="Название организации" required controlId={`${uid}-name`} error={errors.name}>
                        <Input
                          value={form.name}
                          maxLength={200}
                          placeholder="Например, Luxx Group"
                          onChange={(e) => set('name', e.target.value)}
                        />
                      </Field>
                      <Field label="Бренд / публичное название" required controlId={`${uid}-brand`} error={errors.brand}>
                        <Input
                          value={form.brand}
                          maxLength={200}
                          placeholder="Например, Luxx"
                          onChange={(e) => set('brand', e.target.value)}
                        />
                      </Field>
                    </FormGrid>
                    <div role="radiogroup" aria-label="Направление бизнеса" className="org-create__verticals">
                      <span className="field__label field__label--required">Направление бизнеса</span>
                      <div>
                        {CREATE_VERTICALS.map((v) => (
                          <label key={v} className="org-create__vertical" data-selected={form.vertical === v || undefined}>
                            <input
                              type="radio"
                              name={`${uid}-vertical`}
                              checked={form.vertical === v}
                              onChange={() => set('vertical', v)}
                            />
                            <Icon name={VERTICAL_ICON[v]} />
                            {CREATE_VERTICAL_LABEL[v]}
                          </label>
                        ))}
                      </div>
                    </div>
                    <FormGrid columns={3}>
                      <Field label="Владелец, имя" required controlId={`${uid}-owner`} error={errors.ownerName}>
                        <Input
                          value={form.ownerName}
                          maxLength={200}
                          autoComplete="off"
                          onChange={(e) => set('ownerName', e.target.value)}
                        />
                      </Field>
                      <Field label="Телефон" required controlId={`${uid}-phone`} error={errors.ownerPhone}>
                        <span className="org-create__phone">
                          <Select
                            aria-label="Страна телефона"
                            value={form.phoneCountry}
                            onChange={(e) => set('phoneCountry', e.target.value)}
                          >
                            {PHONE_COUNTRIES.map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.code} {c.dial}
                              </option>
                            ))}
                          </Select>
                          <Input
                            aria-label="Номер телефона"
                            type="tel"
                            value={form.ownerPhone}
                            placeholder="700 123 45 67"
                            onChange={(e) => set('ownerPhone', e.target.value)}
                          />
                        </span>
                      </Field>
                      <Field
                        label="Почта владельца"
                        required
                        controlId={`${uid}-email`}
                        error={errors.ownerEmail}
                        hint="На неё откроется доступ владельца"
                      >
                        <Input
                          type="email"
                          value={form.ownerEmail}
                          autoComplete="off"
                          placeholder="owner@company.kz"
                          onChange={(e) => set('ownerEmail', e.target.value)}
                        />
                      </Field>
                    </FormGrid>
                  </fieldset>
                  <fieldset className="org-create__section">
                    <legend>
                      <span className="org-create__badge">2</span> Юридические и региональные настройки
                    </legend>
                    <FormGrid columns={3}>
                      <Field label="Страна" required controlId={`${uid}-country`} error={errors.country}>
                        <Select
                          value={form.country}
                          onChange={(e) => {
                            const c = regionCountry(e.target.value)!;
                            setForm((f) => ({
                              ...f,
                              country: c.code,
                              city: c.cities[0]!.name,
                              timezone: c.cities[0]!.timezone,
                              currency: c.currency,
                            }));
                          }}
                        >
                          {REGION_COUNTRIES.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.name}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Город" required controlId={`${uid}-city`} error={errors.city}>
                        <Select
                          value={form.city}
                          onChange={(e) => {
                            const city = cityOptions.find((c) => c.name === e.target.value);
                            setForm((f) => ({ ...f, city: e.target.value, timezone: city?.timezone ?? f.timezone }));
                          }}
                        >
                          {cityOptions.map((c) => (
                            <option key={c.name} value={c.name}>
                              {c.name}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Часовой пояс" required controlId={`${uid}-tz`} error={errors.timezone}>
                        <Select value={form.timezone} onChange={(e) => set('timezone', e.target.value)}>
                          {REGION_TIMEZONE_OPTIONS.map((o) => (
                            <option key={o.timezone} value={o.timezone}>
                              {timezoneLabel(o.timezone, o.city)}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Валюта" required controlId={`${uid}-currency`} error={errors.currency}>
                        <Select value={form.currency} onChange={(e) => set('currency', e.target.value)}>
                          {REGION_CURRENCIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="БИН / ИИН" required={false} controlId={`${uid}-bin`} error={errors.bin}>
                        <Input
                          value={form.bin}
                          inputMode="numeric"
                          placeholder="Например, 123456789012"
                          onChange={(e) => set('bin', e.target.value)}
                        />
                      </Field>
                      <Field label="Сайт" required={false} controlId={`${uid}-site`} error={errors.website}>
                        <Input
                          value={form.website}
                          placeholder="https://example.kz"
                          onChange={(e) => set('website', e.target.value)}
                        />
                      </Field>
                    </FormGrid>
                  </fieldset>
                  <fieldset className="org-create__section">
                    <legend>
                      <span className="org-create__badge">3</span> Что создать сразу
                    </legend>
                    <label className="org-create__switch">
                      <input
                        type="checkbox"
                        role="switch"
                        checked={form.createFirstBranch}
                        onChange={(e) => set('createFirstBranch', e.target.checked)}
                      />
                      <span>
                        Создать первый филиал после сохранения
                        <small>Сразу перейдёте к настройке вашего первого филиала</small>
                      </span>
                    </label>
                  </fieldset>
                </>
              )}
              {step === 1 && (
                <fieldset className="org-create__section">
                  <legend>
                    <span className="org-create__badge">1</span> Первый филиал
                  </legend>
                  {form.createFirstBranch ? (
                    <FormGrid columns={2}>
                      <Field label="Название филиала" required controlId={`${uid}-branch`} error={errors.branchName}>
                        <Input
                          value={form.branchName}
                          maxLength={200}
                          placeholder={form.brand || 'Например, Luxx Центр'}
                          onChange={(e) => set('branchName', e.target.value)}
                        />
                      </Field>
                      <Field label="Адрес" required={false} controlId={`${uid}-address`} error={errors.branchAddress}>
                        <Input
                          value={form.branchAddress}
                          maxLength={500}
                          placeholder="Город, улица, дом"
                          onChange={(e) => set('branchAddress', e.target.value)}
                        />
                      </Field>
                    </FormGrid>
                  ) : (
                    <p className="muted">Первый филиал не создаётся: его можно добавить позже на странице организации.</p>
                  )}
                  <p className="muted">
                    Часовой пояс и валюта филиала берутся из настроек организации: {summary.zone}, {form.currency}.
                  </p>
                </fieldset>
              )}
              {step === 2 && (
                <fieldset className="org-create__section">
                  <legend>
                    <span className="org-create__badge">1</span> Проверьте и создайте
                  </legend>
                  <dl className="org-create__summary">
                    <dt>Организация</dt>
                    <dd>
                      {form.name.trim()} ({form.brand.trim()}), {CREATE_VERTICAL_LABEL[form.vertical]}
                    </dd>
                    <dt>Владелец</dt>
                    <dd>
                      {form.ownerName.trim()}, {form.ownerEmail.trim().toLowerCase()}
                    </dd>
                    <dt>Регион</dt>
                    <dd>
                      {region?.name}, {form.city}, {summary.zone}, {form.currency}
                    </dd>
                    <dt>Первый филиал</dt>
                    <dd>{summary.branch ?? 'не создаётся'}</dd>
                  </dl>
                  {result && !result.ok && <Alert boxed>{result.error}</Alert>}
                </fieldset>
              )}
            </div>
            <aside className="org-create__aside" aria-label="Что будет создано">
              <h3>Что будет создано</h3>
              <p className="muted">После завершения всех шагов</p>
              <ul>
                <li>
                  <Icon name="inventory" />
                  <span>
                    <strong>Новая организация</strong>
                    <small>{form.name.trim() || 'С указанными данными и настройками'}</small>
                  </span>
                </li>
                <li>
                  <Icon name="guests" />
                  <span>
                    <strong>Доступ владельца</strong>
                    <small>{form.ownerEmail.trim().toLowerCase() || 'Откроется на указанную почту, роль владельца'}</small>
                  </span>
                </li>
                <li>
                  <Icon name={VERTICAL_ICON[form.vertical]} />
                  <span>
                    <strong>{CREATE_VERTICAL_LABEL[form.vertical]}</strong>
                    <small>{form.brand.trim() || 'Бизнес организации'}</small>
                  </span>
                </li>
                <li>
                  <Icon name="board" />
                  <span>
                    <strong>{form.createFirstBranch ? 'Первый филиал' : 'Без филиала'}</strong>
                    <small>{summary.branch ?? 'Добавите позже'}</small>
                  </span>
                </li>
                <li>
                  <Icon name="settings" />
                  <span>
                    <strong>Базовые настройки и валюта</strong>
                    <small>
                      {summary.zone}, {form.currency}
                    </small>
                  </span>
                </li>
              </ul>
              <p className="org-create__note">
                <Icon name="clock" width={16} height={16} /> Заполнение займёт 1–2 минуты. Организация сохраняется сразу и
                начинает работать.
              </p>
            </aside>
          </div>
        )}
        {!created && (
          <footer className="org-create__footer">
            <Button type="button" tone="secondary" onClick={close}>
              Отмена
            </Button>
            <span className="org-create__footer-end">
              {step > 0 && (
                <Button type="button" tone="secondary" onClick={() => setStep((step - 1) as 0 | 1)} disabled={pending}>
                  Назад
                </Button>
              )}
              {step < 2 ? (
                <Button type="button" onClick={next}>
                  Продолжить <Icon name="arrow" width={16} height={16} />
                </Button>
              ) : (
                <Button type="button" onClick={submit} disabled={pending} data-testid="create-organization-submit">
                  {pending ? 'Создаём…' : 'Создать организацию'}
                </Button>
              )}
            </span>
          </footer>
        )}
      </Overlay>
    </>
  );
}
