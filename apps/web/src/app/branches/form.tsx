'use client';
import { useActionState } from 'react';
import { createBranch } from './actions';

// tz-allow: умолчание поля формы для новой записи, не вычисление времени; пояс филиала человек задаёт сам
const DEFAULT_BRANCH_TIMEZONE = 'Asia/Almaty';

export function BranchForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(createBranch, null);
  return (
    <form action={action} className="branch-create">
      <input type="hidden" name="id" value={id} />
      <label>
        Название филиала
        <input
          className="inp"
          name="name"
          required
          maxLength={200}
          placeholder="Например, Luxx Aparts Центр"
        />
      </label>
      <label>
        Адрес
        <input className="inp" name="address" maxLength={500} />
      </label>
      <label>
        Валюта
        <select className="inp" name="currency" required defaultValue="KZT">
          <option>KZT</option>
          <option>RUB</option>
          <option>USD</option>
          <option>EUR</option>
          <option>UZS</option>
          <option>GEL</option>
          <option>AED</option>
        </select>
      </label>
      <label>
        Часовой пояс
        <input
          className="inp"
          name="timezone"
          required
          defaultValue={DEFAULT_BRANCH_TIMEZONE}
          placeholder={DEFAULT_BRANCH_TIMEZONE}
        />
      </label>
      <p className="muted">
        Создаётся пустой филиал. Номера, брони и подключения других объектов не копируются.
        Добавление не подтверждает оплату подписки.
      </p>
      {state?.error && <p role="alert">{state.error}</p>}
      {state?.message && <p role="status">{state.message}</p>}
      <button className="btn" type="submit" disabled={pending || Boolean(state?.message)}>
        {pending ? 'Создаём…' : 'Добавить филиал'}
      </button>
    </form>
  );
}
