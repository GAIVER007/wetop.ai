'use client';
import { useActionState, useEffect, useState } from 'react';
import { SUPPORTED_COUNTRIES, countryOf, currencyOptions } from '@pms/domain';
import { createBranch } from './actions';
import type { BusinessCardView } from '../../lib/api';
import type { WebVertical } from '../../lib/vertical-landing';
import { Input, Select } from '../../components/ui';
import { msg } from '../../i18n';
import { useT } from '../../i18n/locale-provider';
export function BranchForm({
  id,
  onPendingChange,
  businesses,
  newBusinessId,
  initialMode,
  initialBusinessId,
  initialVertical = 'HOSPITALITY',
}: {
  id: string;
  onPendingChange?: (pending: boolean) => void;
  businesses?: BusinessCardView[];
  newBusinessId?: string;
  initialMode?: 'BRANCH' | 'BUSINESS';
  initialBusinessId?: string;
  initialVertical?: WebVertical;
}) {
  const [state, action, pending] = useActionState(createBranch, null);
  const t = useT();
  const [mode, setMode] = useState<'BRANCH' | 'BUSINESS' | 'LEGACY'>(
    businesses === undefined
      ? 'LEGACY'
      : (initialMode ?? (businesses.length ? 'BRANCH' : 'BUSINESS')),
  );
  // пояс идёт от страны, валюта по умолчанию тоже, но её можно сменить (Q-SCHED-3)
  const [country, setCountry] = useState<string>(SUPPORTED_COUNTRIES[0].code);
  const [currency, setCurrency] = useState<string>(SUPPORTED_COUNTRIES[0].currency);
  const [businessId, setBusinessId] = useState(initialBusinessId ?? businesses?.[0]?.id ?? '');
  const selected = businesses?.find((b) => b.id === businessId);
  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);
  return (
    <form action={action} className="branch-create">
      <input type="hidden" name="id" value={id} />
      {businesses !== undefined && (
        <fieldset className="branch-create__mode">
          <legend>{t('Что добавляем')}</legend>
          <label>
            <input
              type="radio"
              name="mode"
              value="BRANCH"
              checked={mode === 'BRANCH'}
              disabled={pending || !businesses.length}
              onChange={() => setMode('BRANCH')}
            />
            {t('Филиал существующего бизнеса')}
          </label>
          <label>
            <input
              type="radio"
              name="mode"
              value="BUSINESS"
              checked={mode === 'BUSINESS'}
              disabled={pending}
              onChange={() => setMode('BUSINESS')}
            />
            {t('Новый бизнес или бренд')}
          </label>
        </fieldset>
      )}
      {mode === 'BRANCH' && (
        <label>
          {t('Бизнес')}
          <Select
            name="businessId"
            value={businessId}
            disabled={pending}
            required
            onChange={(e) => setBusinessId(e.target.value)}
          >
            {businesses?.map((b) => (
              <option value={b.id} key={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <small>{t('Новый филиал будет добавлен именно в этот бизнес.')}</small>
        </label>
      )}
      {mode === 'BRANCH' ? (
        <input type="hidden" name="vertical" value={selected?.vertical ?? initialVertical} />
      ) : (
        <fieldset className="branch-create__vertical" disabled={pending}>
          <legend>{t('Направление бизнеса')}</legend>
          {(
            [
              ['HOSPITALITY', msg('Отель, хостел или апартаменты')],
              ['BEAUTY', msg('Салон красоты или студия')],
              ['FOOD_SERVICE', msg('Кафе или ресторан')],
            ] as const
          ).map(([value, label]) => (
            <label key={value}>
              <input
                type="radio"
                name="vertical"
                value={value}
                defaultChecked={initialVertical === value}
              />
              {t(label)}
            </label>
          ))}
        </fieldset>
      )}
      {mode === 'BUSINESS' && (
        <>
          <input type="hidden" name="newBusinessId" value={newBusinessId} />
          <label>
            {t('Название бизнеса')}
            <Input
              name="businessName"
              required
              maxLength={200}
              disabled={pending}
              placeholder={t('Например, Luxx Hotels')}
            />
          </label>
        </>
      )}
      <label>
        {mode === 'BUSINESS' ? t('Название первого объекта') : t('Название объекта')}
        <Input
          name="name"
          required={mode !== 'BUSINESS'}
          maxLength={200}
          disabled={pending}
          placeholder={mode === 'BUSINESS' ? t('Можно оставить название бизнеса') : t('Например, Центр')}
        />
        {mode === 'BUSINESS' && (
          <small>{t('Если поле пустое, первый объект получит название бизнеса.')}</small>
        )}
      </label>
      <label>
        {t('Адрес')}
        <Input name="address" maxLength={500} disabled={pending} />
      </label>
      <label>
        {t('Страна')}
        <Select
          value={country}
          disabled={pending}
          onChange={(e) => {
            setCountry(e.target.value);
            setCurrency(countryOf({ code: e.target.value })?.currency ?? currency);
          }}
        >
          {SUPPORTED_COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {t(c.label)}
            </option>
          ))}
        </Select>
      </label>
      <input type="hidden" name="timezone" value={countryOf({ code: country })?.zone ?? ''} />
      <label>
        {t('Валюта')}
        <Select
          name="currency"
          required
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          disabled={pending}
        >
          {currencyOptions().map((o) => (
            <option key={o.value} value={o.value}>
              {t(o.label)}
            </option>
          ))}
        </Select>
      </label>
      <p className="muted">{t('Часовой пояс задаёт страна: от него зависят даты записей и отчётов.')}</p>
      <p className="muted">
        {mode === 'BUSINESS'
          ? t('Создадим новый бизнес с первым объектом внутри вашей организации.')
          : t('Настройки, сотрудники и данные других объектов не копируются.')}
      </p>
      {state?.error && <p role="alert">{state.error}</p>}
      {state?.message && <p role="status">{state.message}</p>}
      <button className="btn" type="submit" disabled={pending || Boolean(state?.message)}>
        {pending ? t('Создаём…') : mode === 'BUSINESS' ? t('Создать бизнес') : t('Добавить филиал')}
      </button>
    </form>
  );
}
