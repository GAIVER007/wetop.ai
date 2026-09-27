'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  PENDING_ACCESS,
  allowedItem,
  navigationItems,
  type NavigationAccess,
} from '../../lib/navigation';
import { Icon } from '../icon';
import { Overlay } from '../overlay';
export function GlobalSearch({
  open,
  close,
  access = PENDING_ACCESS,
}: {
  open: boolean;
  close: () => void;
  /** Разделы, закрытые вошедшему (ADR-083, ADR-106), поиск не предлагает; пока API не ответил — как администратору */
  access?: NavigationAccess | undefined;
}) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('guest');
  const router = useRouter();
  const matches = navigationItems
    .filter((n) => allowedItem(n, access))
    .filter((n) => n.label.toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru')))
    .slice(0, 6);
  return (
    <Overlay open={open} onClose={close} title="Быстрый поиск" className="command-palette">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const q = query.trim();
          if (!q) return;
          close();
          router.push(
            kind === 'booking'
              ? `/reservations/${encodeURIComponent(q)}`
              : kind === 'unit'
                ? `/units/${encodeURIComponent(q)}`
                : `/guests?q=${encodeURIComponent(q)}`,
          );
        }}
      >
        <div className="command-input">
          <Icon name="search" />
          <input
            className="inp"
            name="query"
            aria-label="Запрос"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск гостя, брони, номера..."
            autoComplete="off"
            required
          />
        </div>
        <label className="field">
          Искать
          <select
            className="inp"
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="guest">Гостя по имени, телефону или email</option>
            <option value="booking">Бронь по номеру</option>
            <option value="unit">Номер или койку по коду</option>
          </select>
        </label>
        <button className="btn" type="submit">
          <Icon name="search" />
          Найти
        </button>
      </form>
      <div className="command-links">
        <span className="eyebrow">Быстрый переход</span>
        {matches.map((item) => (
          <Link key={item.href} href={item.href} onClick={close}>
            <Icon name={item.icon} />
            <span>{item.label}</span>
            <Icon name="arrow" width={16} />
          </Link>
        ))}
        {!matches.length && <p className="muted">Нет разделов с таким названием</p>}
      </div>
      <div className="command-foot">
        <kbd>esc</kbd> закрыть <span>Поиск по текущему объекту</span>
      </div>
    </Overlay>
  );
}
