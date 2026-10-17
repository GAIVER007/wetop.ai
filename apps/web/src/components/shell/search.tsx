'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PENDING_ACCESS, menuSectionsFor, type NavigationAccess } from '../../lib/navigation';
import type { WebVertical } from '../../lib/vertical-landing';
import { Icon } from '../icon';
import { Overlay } from '../overlay';
/**
 * Разделы для быстрого перехода: меню своего направления (аудит платформы 17.10.2026, Д3), без повторов адреса.
 * Раньше список всегда строился по гостиничному меню и салону предлагал «Календарь» шахматки.
 */
export function searchMatches(access: NavigationAccess, vertical: WebVertical, query: string) {
  const q = query.toLocaleLowerCase('ru');
  return menuSectionsFor(access, vertical)
    .flatMap((section) => section.items)
    .filter((item, index, items) => items.findIndex((other) => other.href === item.href) === index)
    .filter((n) => n.label.toLocaleLowerCase('ru').includes(q))
    .slice(0, 6);
}

export function GlobalSearch({
  open,
  close,
  access = PENDING_ACCESS,
  vertical = 'HOSPITALITY',
}: {
  open: boolean;
  close: () => void;
  /** Разделы, закрытые вошедшему (ADR-083, ADR-107), поиск не предлагает; пока API не ответил — как администратору */
  access?: NavigationAccess | undefined;
  /** Направление филиала: его меню в быстром переходе; поиск гостя, брони и номера пока только у гостиницы */
  vertical?: WebVertical | undefined;
}) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('guest');
  const router = useRouter();
  const matches = searchMatches(access, vertical, query);
  // экраны записей и броней столов запрос `q` не принимают (контракт с их владельцем): салон и ресторан
  // ищут раздел, Enter открывает первое совпадение
  const entities = vertical === 'HOSPITALITY';
  return (
    <Overlay open={open} onClose={close} title="Быстрый поиск" className="command-palette">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const q = query.trim();
          if (!q) return;
          if (!entities) {
            if (!matches[0]) return;
            close();
            router.push(matches[0].href);
            return;
          }
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
            placeholder={entities ? 'Поиск гостя, брони, номера...' : 'Название раздела'}
            autoComplete="off"
            required
          />
        </div>
        {entities && (
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
        )}
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
        <kbd>esc</kbd> закрыть{' '}
        <span>{entities ? 'Поиск по текущему объекту' : 'Разделы текущего филиала'}</span>
      </div>
    </Overlay>
  );
}
