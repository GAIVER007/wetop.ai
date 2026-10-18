'use client';
import { useActionState, useEffect, useState } from 'react';
import { SUPPORTED_COUNTRIES, countryOf, currencyOptions } from '@pms/domain';
import { createBranch } from './actions';
import type { BusinessCardView } from '../../lib/api';
import type { WebVertical } from '../../lib/vertical-landing';
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
          <legend>Что добавляем</legend>
          <label>
            <input
              type="radio"
              name="mode"
              value="BRANCH"
              checked={mode === 'BRANCH'}
              disabled={pending || !businesses.length}
              onChange={() => setMode('BRANCH')}
            />
            Филиал существующего бизнеса
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
            Новый бизнес или бренд
          </label>
        </fieldset>
      )}
      {mode === 'BRANCH' && (
        <label>
          Бизнес
          <select
            className="inp"
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
          </select>
          <small>Новый филиал будет добавлен именно в этот бизнес.</small>
        </label>
      )}
      {mode === 'BRANCH' ? (
        <input type="hidden" name="vertical" value={selected?.vertical ?? initialVertical} />
      ) : (
        <fieldset className="branch-create__vertical" disabled={pending}>
          <legend>Направление бизнеса</legend>
          {(
            [
              ['HOSPITALITY', 'Отель, хостел или апартаменты'],
              ['BEAUTY', 'Салон красоты или студия'],
              ['FOOD_SERVICE', 'Кафе или ресторан'],
            ] as const
          ).map(([value, label]) => (
            <label key={value}>
              <input
                type="radio"
                name="vertical"
                value={value}
                defaultChecked={initialVertical === value}
              />
              {label}
            </label>
          ))}
        </fieldset>
      )}
      {mode === 'BUSINESS' && (
        <>
          <input type="hidden" name="newBusinessId" value={newBusinessId} />
          <label>
            Название бизнеса
            <input
              className="inp"
              name="businessName"
              required
              maxLength={200}
              disabled={pending}
              placeholder="Например, Luxx Hotels"
            />
          </label>
        </>
      )}
      <label>
        {mode === 'BUSINESS' ? 'Название первого объекта' : 'Название объекта'}
        <input
          className="inp"
          name="name"
          required={mode !== 'BUSINESS'}
          maxLength={200}
          disabled={pending}
          placeholder={mode === 'BUSINESS' ? 'Можно оставить название бизнеса' : 'Например, Центр'}
        />
        {mode === 'BUSINESS' && (
          <small>Если поле пустое, первый объект получит название бизнеса.</small>
        )}
      </label>
      <label>
        Адрес
        <input className="inp" name="address" maxLength={500} disabled={pending} />
      </label>
      <label>
        Страна
        <select
          className="inp"
          value={country}
          disabled={pending}
          onChange={(e) => {
            setCountry(e.target.value);
            setCurrency(countryOf({ code: e.target.value })?.currency ?? currency);
          }}
        >
          {SUPPORTED_COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <input type="hidden" name="timezone" value={countryOf({ code: country })?.zone ?? ''} />
      <label>
        Валюта
        <select
          className="inp"
          name="currency"
          required
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          disabled={pending}
        >
          {currencyOptions().map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <p className="muted">Часовой пояс задаёт страна: от него зависят даты записей и отчётов.</p>
      <p className="muted">
        {mode === 'BUSINESS'
          ? 'Создадим новый бизнес с первым объектом внутри вашей организации.'
          : 'Настройки, сотрудники и данные других объектов не копируются.'}
      </p>
      {state?.error && <p role="alert">{state.error}</p>}
      {state?.message && <p role="status">{state.message}</p>}
      <button className="btn" type="submit" disabled={pending || Boolean(state?.message)}>
        {pending ? 'Создаём…' : mode === 'BUSINESS' ? 'Создать бизнес' : 'Добавить филиал'}
      </button>
    </form>
  );
}
