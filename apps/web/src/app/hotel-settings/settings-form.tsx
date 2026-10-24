'use client';
import {
  useActionState,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import {
  CANCELLATION_RULES,
  CANCELLATION_RULE_LABELS,
  CHANNEX_PROPERTY_TYPES,
  DEPOSIT_RULES,
  DEPOSIT_RULE_LABELS,
  ONSITE_PAYMENTS,
  ONSITE_PAYMENT_LABELS,
  PROPERTY_AMENITIES,
  normalizeClockTime,
  normalizeWebsite,
} from '@pms/domain';
import { CheckChip } from '../../components/chip';
import { Icon, type IconName } from '../../components/icon';
import { IconField } from '../../components/icon-field';
import { Switch } from '../../components/switch';
import { Alert, Field, Input, Panel, Select, Textarea, cx } from '../../components/ui';
import type { HotelSettings } from '../../lib/hotel-api';
import { saveHotelSettings, type SettingsActionResult } from './actions';
import {
  AMENITIES_VISIBLE,
  COUNTRIES,
  KZ_CITIES,
  TIME_OPTIONS,
  amenityIcon,
  formText,
  readFormField,
  withCardDefaults,
} from './card-model';
import { PreviewPanel, type PreviewPhoto } from './object-preview';
import { SETTINGS_FORM_ID, useLiveReport, useSaveReport, type LiveValues } from './settings-save';
import { phoneFieldValue, phoneOnInput } from '../../lib/phone';
import { zoneLabel } from '../../lib/human-period';
import { msg } from '../../i18n';
import { useT } from '../../i18n/locale-provider';

type Property = HotelSettings['property'];
type FieldName = keyof Property;
/** Проверка поля до отправки: причина словами или null. Ошибка стоит у поля (DESIGN.md §8: `aria-invalid` + текст под полем) */
type Validate = (name: FieldName, raw: string) => string | null;
type Check = (name: FieldName) => {
  props: { 'aria-invalid'?: true; 'aria-describedby'?: string };
  error: ReactNode;
};
type Value = (name: FieldName) => string;

/**
 * Одна форма вкладки «Настроек объекта» (ТЗ ux-retention п. 3.1, UQ-1; ТЗ «Настройки объекта» v2, ADR-115; карточки по
 * верстке владельца, ADR-158). Шлёт только свои поля: разбор API принимает любое подмножество, и «Проживание» не
 * затирает «Основное». «Есть изменения» считается сравнением ввода с записью объекта: вернули старое значение,
 * кнопка снова выключена. Отказ API не стирает ввод (`values` + `attempt`). Текущие значения полей форма отдаёт
 * шапке (`useLiveReport`): по ним строится предпросмотр карточки до сохранения.
 */
function SettingsForm({
  property,
  fields,
  testId,
  validate,
  editable,
  children,
}: {
  property: Property;
  fields: readonly FieldName[];
  testId: string;
  validate?: Validate;
  editable: boolean;
  children: (value: Value, check: Check, live: LiveValues) => ReactNode;
}) {
  const t = useT();
  const [state, action, pending] = useActionState<SettingsActionResult | null, FormData>(
    saveHotelSettings,
    null,
  );
  const form = useRef<HTMLFormElement>(null);
  const [dirty, setDirty] = useState(false);
  const full = withCardDefaults(property);
  const stored = (name: FieldName) => formText(full[name]);
  const [live, setLive] = useState<LiveValues>(() =>
    Object.fromEntries(fields.map((name) => [name, stored(name)])),
  );
  const recompute = useCallback(() => {
    const data = form.current ? new FormData(form.current) : null;
    const now = withCardDefaults(property);
    if (!data) return;
    const snapshot = Object.fromEntries(fields.map((name) => [name, readFormField(data, name)]));
    setLive(snapshot);
    setDirty(fields.some((name) => snapshot[name] !== formText(now[name])));
  }, [fields, property]);
  // после ответа API: ввод остался (отказ) или запись объекта обновилась (сохранено) — пересчитать
  useEffect(recompute, [recompute, state]);
  useSaveReport({ dirty, pending, saved: !!state?.message && !dirty });
  useLiveReport(live);
  const kept = state?.values;
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const errorPrefix = useId();
  const checkField = (name: FieldName, raw: string) =>
    setErrors((was) => {
      const reason = validate?.(name, raw) ?? null;
      if ((was[name] ?? null) === reason) return was;
      const next = { ...was };
      if (reason) next[name] = reason;
      else delete next[name];
      return next;
    });
  const fieldOf = (target: EventTarget) =>
    target instanceof HTMLInputElement && (fields as readonly string[]).includes(target.name)
      ? (target as HTMLInputElement & { name: FieldName })
      : null;
  const check: Check = (name) =>
    errors[name]
      ? {
          props: { 'aria-invalid': true, 'aria-describedby': `${errorPrefix}-${name}` },
          error: <Alert id={`${errorPrefix}-${name}`}>{t(errors[name] ?? '')}</Alert>,
        }
      : { props: {}, error: null };
  return (
    <form
      id={SETTINGS_FORM_ID}
      ref={form}
      action={action}
      key={state?.attempt ?? 0}
      onChange={(event) => {
        recompute();
        // поле с ошибкой проверяем на ходу — как только ввод исправлен, причина уходит
        const input = fieldOf(event.target);
        if (input && errors[input.name]) checkField(input.name, input.value);
      }}
      onInput={(event) => {
        if (event.target instanceof HTMLTextAreaElement) recompute();
      }}
      onBlur={(event) => {
        const input = fieldOf(event.target);
        if (input && input.value.trim() !== '') checkField(input.name, input.value);
      }}
      onSubmit={(event) => {
        if (!validate) return;
        const data = new FormData(event.currentTarget);
        const found: Partial<Record<FieldName, string>> = {};
        for (const name of fields) {
          const reason = validate(name, readFormField(data, name));
          if (reason) found[name] = reason;
        }
        setErrors(found);
        if (Object.keys(found).length) event.preventDefault();
      }}
      data-testid={testId}
      className={cx('settings-form', testId === 'hotel-settings-form' && 'settings-form--general')}
      noValidate
    >
      {state?.error && <Alert boxed>{state.error}</Alert>}
      <fieldset className="obj-fieldset" disabled={!editable}>
        {children(
          (name) => kept?.[name] ?? stored(name),
          check,
          live,
        )}
      </fieldset>
      <datalist id="obj-time-options">
        {TIME_OPTIONS.map((time) => (
          <option key={time} value={time} />
        ))}
      </datalist>
    </form>
  );
}

const GENERAL = [
  'name',
  'phone',
  'email',
  'address',
  'website',
  'description',
  'countryCode',
  'city',
  'channexPropertyType',
  'legalName',
  'bin',
  'publicName',
  'checkInTime',
  'checkOutTime',
  'earlyCheckIn',
  'lateCheckOut',
  'childrenAllowed',
  'petsAllowed',
  'onsitePayment',
  'cancellationRule',
  'depositRule',
  'minGuestAge',
  'quietHoursFrom',
  'quietHoursTo',
  'smokingAllowed',
  'houseRulesNote',
  'amenities',
] as const satisfies readonly FieldName[];
const STAY = [
  'checkInTime',
  'checkOutTime',
  'earlyCheckIn',
  'lateCheckOut',
  'childrenAllowed',
  'petsAllowed',
  'onsitePayment',
  'cancellationRule',
  'depositRule',
  'minGuestAge',
  'quietHoursFrom',
  'quietHoursTo',
  'smokingAllowed',
  'houseRulesNote',
] as const satisfies readonly FieldName[];
const PROPERTY_TYPE_LABELS: Record<(typeof CHANNEX_PROPERTY_TYPES)[number], string> = {
  apart_hotel: msg('Апарт-отель'),
  apartment: msg('Апартаменты'),
  boat: msg('Размещение на судне'),
  camping: msg('Кемпинг'),
  capsule_hotel: msg('Капсульный отель'),
  chalet: msg('Шале'),
  country_house: msg('Загородный дом'),
  farm_stay: msg('Проживание на ферме'),
  guest_house: msg('Гостевой дом'),
  holiday_home: msg('Дом для отдыха'),
  holiday_park: msg('Парк отдыха'),
  homestay: msg('Проживание в доме'),
  hostel: msg('Хостел'),
  hotel: msg('Отель'),
  inn: msg('Мини-отель'),
  lodge: msg('Лодж'),
  motel: msg('Мотель'),
  resort: msg('Курортный отель'),
  riad: msg('Риад'),
  ryokan: msg('Рёкан'),
};

/** Время — всегда 24 часа (DESIGN.md §14): не `type="time"`, который рисует «02:00 PM» по языку браузера */
const TIME_ERROR: Partial<Record<FieldName, string>> = {
  quietHoursFrom: msg('Тихие часы, начало — в виде 22:00'),
  quietHoursTo: msg('Тихие часы, конец — в виде 22:00'),
};
const validateCard: Validate = (name, raw) => {
  const value = raw.trim();
  switch (name) {
    case 'checkInTime':
    case 'checkOutTime':
      return normalizeClockTime(value) === null
        ? name === 'checkInTime'
          ? msg('Время заезда — в виде 14:00')
          : msg('Время выезда — в виде 14:00')
        : null;
    case 'quietHoursFrom':
    case 'quietHoursTo':
      return value !== '' && normalizeClockTime(value) === null
        ? (TIME_ERROR[name] ?? null)
        : null;
    case 'website':
      return value !== '' && normalizeWebsite(value) === null
        ? msg('Адрес сайта в виде https://example.kz')
        : null;
    case 'minGuestAge':
      return /^\d{1,2}$/.test(value) ? null : msg('Возраст — целое число от 0 до 99');
    default:
      return null;
  }
};

/** Карточка экрана: значок, заголовок, пояснение, содержимое (верстка владельца, ADR-156) */
function ObjectCard({
  id,
  icon,
  title,
  subtitle,
  className,
  children,
  ...rest
}: {
  id: string;
  icon: IconName;
  title: string;
  subtitle?: string;
  className?: string;
  children: ReactNode;
  'data-testid'?: string;
}) {
  const t = useT();
  return (
    <Panel className={cx('settings-block obj-card', className)} aria-labelledby={id} {...rest}>
      <header className="obj-card__head">
        <span className="obj-card__icon" aria-hidden="true">
          <Icon name={icon} width={20} height={20} />
        </span>
        <div>
          <h2 id={id}>{t(title)}</h2>
          {subtitle && <p className="obj-card__sub">{t(subtitle)}</p>}
        </div>
      </header>
      {children}
    </Panel>
  );
}

/** Только чтение: значение поля, которое меняет поддержка или которое считается по фонду */
function ReadonlyField({ label, icon, value }: { label: string; icon: IconName; value: string }) {
  const t = useT();
  return (
    <Field label={t(label)}>
      <IconField icon={icon}>
        <Input readOnly value={value} />
      </IconField>
    </Field>
  );
}

function CountedTextarea({
  name,
  defaultValue,
  max,
  rows,
  label,
}: {
  name: string;
  defaultValue: string;
  max: number;
  rows: number;
  label: string;
}) {
  const t = useT();
  const [length, setLength] = useState(defaultValue.length);
  return (
    <Field label={t(label)} className="settings-fields__wide">
      <span className="obj-counted">
        <Textarea
          name={name}
          rows={rows}
          maxLength={max}
          defaultValue={defaultValue}
          onInput={(event) => setLength(event.currentTarget.value.length)}
        />
        <span className="obj-counted__n" aria-hidden="true">
          {length}/{max}
        </span>
      </span>
    </Field>
  );
}

function TimeField({
  name,
  label,
  value,
  check,
  placeholder,
  required,
}: {
  name: 'checkInTime' | 'checkOutTime';
  label: string;
  value: Value;
  check: Check;
  placeholder: string;
  required?: boolean;
}) {
  const t = useT();
  const { props, error } = check(name);
  return (
    <Field label={t(label)}>
      <IconField icon="clock">
        <Input
          name={name}
          required={required}
          inputMode="numeric"
          autoComplete="off"
          maxLength={5}
          list="obj-time-options"
          placeholder={placeholder}
          className="settings-time"
          defaultValue={value(name)}
          {...props}
        />
      </IconField>
      {error}
    </Field>
  );
}

function MainInfoCard({
  value,
  check,
  extra,
}: {
  value: Value;
  check: Check;
  extra?: ReactNode;
}) {
  const t = useT();
  const website = check('website');
  return (
    <ObjectCard
      id="settings-main"
      icon="hotel"
      title={msg('Основная информация')}
      subtitle={msg('Базовые данные объекта, которые видят гости и каналы продаж.')}
    >
      <div className="settings-fields">
        <Field label={t('Название объекта')} required className="settings-fields__wide">
          <Input name="name" maxLength={200} defaultValue={value('name')} />
        </Field>
        <CountedTextarea
          label={msg('Краткое описание')}
          name="description"
          defaultValue={value('description')}
          max={500}
          rows={3}
        />
        <Field label={t('Телефон')}>
          <IconField icon="phone">
            <Input name="phone" type="tel" inputMode="tel" placeholder="+7 701 000 00 00" onInput={phoneOnInput} defaultValue={phoneFieldValue(value('phone'))} />
          </IconField>
        </Field>
        <Field label={t('Почта')}>
          <IconField icon="mail">
            <Input name="email" type="email" defaultValue={value('email')} />
          </IconField>
        </Field>
        <Field label={t('Адрес')} className="settings-fields__wide">
          <IconField icon="pin">
            <Input name="address" maxLength={300} defaultValue={value('address')} />
          </IconField>
        </Field>
        <Field label={t('Сайт')} className="settings-fields__wide">
          <IconField icon="link">
            <Input
              name="website"
              inputMode="url"
              autoComplete="off"
              maxLength={300}
              placeholder="https://example.kz"
              defaultValue={value('website')}
              {...website.props}
            />
          </IconField>
          {website.error}
        </Field>
      </div>
      {extra}
    </ObjectCard>
  );
}

function AmenitiesCard({ value }: { value: Value }) {
  const t = useT();
  const chosen = value('amenities').split(',').filter(Boolean);
  const [all, setAll] = useState(false);
  const shown = PROPERTY_AMENITIES.filter(
    (a, i) => all || i < AMENITIES_VISIBLE || chosen.includes(a.code),
  );
  const hidden = PROPERTY_AMENITIES.length - shown.length;
  return (
    <ObjectCard
      id="settings-amenities"
      icon="settings"
      title={msg('Услуги и удобства')}
      subtitle={msg('Выберите, какие удобства есть в объекте. Они будут отображаться в описании и на каналах продаж.')}
      data-testid="amenities-card"
    >
      <input type="hidden" name="amenities" value="" />
      <div className="chip-group obj-amenities">
        {shown.map((a) => (
          <CheckChip
            key={a.code}
            name="amenities"
            value={a.code}
            defaultChecked={chosen.includes(a.code)}
            icon={<Icon name={amenityIcon(a.code)} width={16} height={16} />}
          >
            {t(a.label)}
          </CheckChip>
        ))}
        {hidden > 0 && (
          <button
            type="button"
            className="chip chip--dashed"
            onClick={() => setAll(true)}
            data-testid="amenities-more"
          >
            <Icon name="plus" width={16} height={16} />
            {t('Добавить услугу')}
          </button>
        )}
      </div>
    </ObjectCard>
  );
}

function StayCard({ value, check }: { value: Value; check: Check }) {
  const t = useT();
  return (
    <ObjectCard
      id="settings-stay"
      icon="clock"
      title={msg('Заезд и выезд')}
      subtitle={msg('Укажите время заезда и выезда, а также дополнительные опции.')}
      data-testid="stay-settings"
    >
      <div className="settings-fields">
        <TimeField
          name="checkInTime"
          label={msg('Заезд с')}
          value={value}
          check={check}
          placeholder="14:00"
          required
        />
        <TimeField
          name="checkOutTime"
          label={msg('Выезд до')}
          value={value}
          check={check}
          placeholder="12:00"
          required
        />
        <Switch
          name="earlyCheckIn"
          label={t('Ранний заезд')}
          hint={t('При наличии возможности')}
          defaultChecked={value('earlyCheckIn') === 'true'}
        />
        <Switch
          name="lateCheckOut"
          label={t('Поздний выезд')}
          hint={t('При наличии возможности')}
          defaultChecked={value('lateCheckOut') === 'true'}
        />
      </div>
      <div className="obj-banner">
        <Icon name="info" width={18} height={18} />
        <p>
          <b>{t('Настройте автоматические правила и условия')}</b>
          <span>{t('Например, доплаты, ограничение по времени и др.')}</span>
        </p>
        <Link className="obj-banner__link" href="/rooms/categories">
          {t('Настроить')}
          <Icon name="arrow" width={14} height={14} />
        </Link>
      </div>
    </ObjectCard>
  );
}

function RuleRow({
  icon,
  label,
  children,
}: {
  icon: IconName;
  label: string;
  children: ReactNode;
}) {
  const t = useT();
  return (
    <div className="obj-rule">
      <span className="obj-rule__label">
        <Icon name={icon} width={18} height={18} />
        {t(label)}
      </span>
      <div className="obj-rule__control">{children}</div>
    </div>
  );
}

function RulesCard({ value, check }: { value: Value; check: Check }) {
  const t = useT();
  const age = check('minGuestAge');
  const from = check('quietHoursFrom');
  const to = check('quietHoursTo');
  return (
    <ObjectCard
      id="settings-rules"
      icon="file"
      title={msg('Правила проживания')}
      subtitle={msg('Укажите основные правила и условия для гостей.')}
      data-testid="rules-card"
    >
      <div className="obj-rules">
        <RuleRow icon="baby" label={msg('Можно с детьми')}>
          <Switch
            name="childrenAllowed"
            label={<span className="sr-only">{t('Можно с детьми')}</span>}
            defaultChecked={value('childrenAllowed') === 'true'}
          />
        </RuleRow>
        <RuleRow icon="paw" label={msg('Можно с питомцами')}>
          <Switch
            name="petsAllowed"
            label={<span className="sr-only">{t('Можно с питомцами')}</span>}
            defaultChecked={value('petsAllowed') === 'true'}
          />
        </RuleRow>
        <RuleRow icon="card" label={msg('Способ оплаты на месте')}>
          <Select
            key={value('onsitePayment')}
            name="onsitePayment"
            aria-label={t('Способ оплаты на месте')}
            defaultValue={value('onsitePayment')}
          >
            {ONSITE_PAYMENTS.map((c) => (
              <option key={c} value={c}>
                {t(ONSITE_PAYMENT_LABELS[c])}
              </option>
            ))}
          </Select>
        </RuleRow>
        <RuleRow icon="calendarOff" label={msg('Отмена брони')}>
          <Select
            key={value('cancellationRule')}
            name="cancellationRule"
            aria-label={t('Отмена брони')}
            defaultValue={value('cancellationRule')}
          >
            {CANCELLATION_RULES.map((c) => (
              <option key={c} value={c}>
                {t(CANCELLATION_RULE_LABELS[c])}
              </option>
            ))}
          </Select>
        </RuleRow>
        <RuleRow icon="deposit" label={msg('Залог')}>
          <Select
            key={value('depositRule')}
            name="depositRule"
            aria-label={t('Залог')}
            defaultValue={value('depositRule')}
          >
            {DEPOSIT_RULES.map((c) => (
              <option key={c} value={c}>
                {t(DEPOSIT_RULE_LABELS[c])}
              </option>
            ))}
          </Select>
        </RuleRow>
        <RuleRow icon="person" label={msg('Минимальный возраст гостя')}>
          <span className="obj-age">
            <Input
              name="minGuestAge"
              aria-label={t('Минимальный возраст гостя')}
              inputMode="numeric"
              maxLength={3}
              defaultValue={value('minGuestAge')}
              {...age.props}
            />
            <span className="obj-age__unit">{t('лет')}</span>
          </span>
          {age.error}
        </RuleRow>
        <RuleRow icon="moon" label={msg('Тихие часы')}>
          <span className="obj-quiet">
            <Input
              name="quietHoursFrom"
              aria-label={t('Тихие часы, начало')}
              inputMode="numeric"
              autoComplete="off"
              maxLength={5}
              list="obj-time-options"
              placeholder="22:00"
              className="settings-time"
              defaultValue={value('quietHoursFrom')}
              {...from.props}
            />
            <span aria-hidden="true">–</span>
            <Input
              name="quietHoursTo"
              aria-label={t('Тихие часы, конец')}
              inputMode="numeric"
              autoComplete="off"
              maxLength={5}
              list="obj-time-options"
              placeholder="08:00"
              className="settings-time"
              defaultValue={value('quietHoursTo')}
              {...to.props}
            />
          </span>
          {from.error}
          {to.error}
        </RuleRow>
        <RuleRow icon="smokeOff" label={msg('Курение запрещено')}>
          <Switch
            name="smokingAllowed"
            inverted
            label={<span className="sr-only">{t('Курение запрещено')}</span>}
            defaultChecked={value('smokingAllowed') !== 'true'}
          />
        </RuleRow>
        <CountedTextarea
          label={msg('Дополнительные комментарии')}
          name="houseRulesNote"
          defaultValue={value('houseRulesNote')}
          max={500}
          rows={3}
        />
      </div>
    </ObjectCard>
  );
}

function LocationCard({
  value,
  property,
  rooms,
  beds,
}: {
  value: Value;
  property: Property;
  rooms: number | null;
  beds: number | null;
}) {
  const t = useT();
  const country = value('countryCode');
  const countries = COUNTRIES.some(([c]) => c === country) || !country
    ? COUNTRIES
    : [...COUNTRIES, [country, country] as const];
  const type = value('channexPropertyType');
  return (
    <ObjectCard
      id="settings-channex-location"
      icon="pin"
      title={msg('Расположение и классификация')}
      subtitle={msg('Эти данные используются для каналов продаж и фильтров.')}
    >
      <div className="settings-fields">
        <Field label={t('Страна (ISO)')}>
          <IconField icon="globe">
            <Select name="countryCode" key={country} defaultValue={country}>
              <option value="">{t('Выберите страну')}</option>
              {countries.map(([code, label]) => (
                <option key={code} value={code}>
                  {t(label)} ({code})
                </option>
              ))}
            </Select>
          </IconField>
        </Field>
        <Field label={t('Город')}>
          <Input name="city" maxLength={100} list="obj-cities" defaultValue={value('city')} />
          <datalist id="obj-cities">
            {KZ_CITIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label={t('Тип размещения')} className="settings-fields__wide">
          <IconField icon="hotel">
            <Select name="channexPropertyType" key={type} defaultValue={type}>
              <option value="">{t('Выберите тип')}</option>
              {CHANNEX_PROPERTY_TYPES.map((kind) => (
                <option key={kind} value={kind}>
                  {t(PROPERTY_TYPE_LABELS[kind])}
                </option>
              ))}
            </Select>
          </IconField>
        </Field>
        <ReadonlyField label={msg('Часовой пояс')} icon="clock" value={zoneLabel(property.timezone, t)} />
        <ReadonlyField label={msg('Валюта')} icon="cash" value={property.currency} />
        <ReadonlyField
          label={msg('Количество номеров')}
          icon="bed"
          value={rooms === null ? '—' : String(rooms)}
        />
        <ReadonlyField
          label={msg('Количество мест')}
          icon="guests"
          value={beds === null ? '—' : String(beds)}
        />
      </div>
      <p className="obj-card__note">
        {t('Часовой пояс и валюту меняет поддержка WETOP: от них зависят цены, счета и границы ночей. Номера и места считаются по номерному фонду.')}
      </p>
    </ObjectCard>
  );
}

function LegalCard({
  value,
  owner,
  extra,
}: {
  value: Value;
  owner: boolean;
  extra?: ReactNode;
}) {
  const t = useT();
  return (
    <ObjectCard
      id="settings-legal"
      icon="file"
      title={msg('Юридические данные')}
      subtitle={msg('Используются в договоре и счёте для гостей.')}
    >
      <div className="settings-fields">
        <Field label={t('Юридическое лицо')}>
          <Input name="legalName" maxLength={300} defaultValue={value('legalName')} />
        </Field>
        {owner && (
          <Field label={t('ИИН/БИН')}>
            <Input name="bin" inputMode="numeric" maxLength={12} defaultValue={value('bin')} />
          </Field>
        )}
        <Field label={t('Публичное имя для документов')} className="settings-fields__wide">
          <Input name="publicName" maxLength={200} defaultValue={value('publicName')} />
        </Field>
      </div>
      {extra}
    </ObjectCard>
  );
}

function PreviewCardBlock({ live, photos }: { live: LiveValues; photos: PreviewPhoto[] }) {
  return (
    <ObjectCard
      id="settings-preview"
      icon="eye"
      title={msg('Как объект увидит гость / каналы продаж')}
      className="obj-card--preview"
    >
      <PreviewPanel initial={live} photos={photos} />
    </ObjectCard>
  );
}

export function GeneralSettingsForm({
  property,
  editable,
  owner,
  capacity,
  photos,
  photoSlot,
  contractSlot,
}: {
  property: Property;
  editable: boolean;
  owner: boolean;
  capacity: { rooms: number; beds: number } | null;
  photos: PreviewPhoto[];
  photoSlot?: ReactNode;
  contractSlot?: ReactNode;
}) {
  return (
    <SettingsForm
      property={property}
      fields={GENERAL}
      testId="hotel-settings-form"
      validate={validateCard}
      editable={editable}
    >
      {(value, check, live) => (
        <div className="obj-grid">
          <div className="obj-col">
            <MainInfoCard value={value} check={check} extra={photoSlot} />
            <AmenitiesCard value={value} />
          </div>
          <div className="obj-col">
            <StayCard value={value} check={check} />
            <RulesCard value={value} check={check} />
          </div>
          <div className="obj-col">
            <LocationCard
              value={value}
              property={property}
              rooms={capacity?.rooms ?? null}
              beds={capacity?.beds ?? null}
            />
            <LegalCard value={value} owner={owner} extra={contractSlot} />
            <PreviewCardBlock live={live} photos={photos} />
          </div>
        </div>
      )}
    </SettingsForm>
  );
}

export function StaySettingsForm({
  property,
  editable,
  capacity,
}: {
  property: Property;
  editable: boolean;
  capacity: { rooms: number; beds: number } | null;
}) {
  return (
    <SettingsForm
      property={property}
      fields={STAY}
      testId="stay-form"
      validate={validateCard}
      editable={editable}
    >
      {(value, check) => (
        <div className="obj-grid obj-grid--two">
          <div className="obj-col">
            <StayCard value={value} check={check} />
            <StayNote timezone={property.timezone} />
          </div>
          <div className="obj-col">
            <RulesCard value={value} check={check} />
            {capacity && <CapacityNote rooms={capacity.rooms} beds={capacity.beds} />}
          </div>
        </div>
      )}
    </SettingsForm>
  );
}

/** Где видны часы. Ночи от них не зависят — проживание хранится датами (AGENTS.md §13) */
export function StayNote({ timezone }: { timezone: string }) {
  const t = useT();
  return (
    <p className="settings-note">
      {t('По времени объекта ({zone}). Эти часы печатаются в договоре, их видит гость в модуле бронирования на сайте, по ним отвечает ИИ-продавец.', { zone: zoneLabel(timezone, t) })}
    </p>
  );
}

function CapacityNote({ rooms, beds }: { rooms: number; beds: number }) {
  const t = useT();
  return (
    <p className="settings-note">
      {t('В продаже: {rooms} номеров и {beds} мест. Состав меняется в разделе', { rooms, beds })}{' '}
      <Link href="/rooms/categories">{t('«Категории номеров»')}</Link>.
    </p>
  );
}

/** Для просмотра без права правки и при отказе чтения тот же экран строит `GeneralSettingsForm` с `editable={false}` */
export type { Property as SettingsProperty };
