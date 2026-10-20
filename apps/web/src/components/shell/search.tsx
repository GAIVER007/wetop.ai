'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { PENDING_ACCESS, menuSectionsFor, type NavigationAccess } from '../../lib/navigation';
import type { WebVertical } from '../../lib/vertical-landing';
import { Icon, type IconName } from '../icon';
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

/** Что можно найти по введённому тексту: гость всегда, бронь и номер только если в запросе есть цифра */
export function entityResults(query: string) {
  const q = query.trim();
  if (!q) return [];
  const code = encodeURIComponent(q);
  const rows: { href: string; label: string; icon: IconName }[] = [
    { href: `/guests?q=${code}`, label: `Гость: ${q}`, icon: 'person' },
  ];
  if (/\d/.test(q)) {
    rows.push(
      { href: `/reservations/${code}`, label: `Бронь №${q}`, icon: 'booking' },
      { href: `/units/${code}`, label: `Номер или койка ${q}`, icon: 'hotel' },
    );
  }
  return rows;
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
  /** Направление филиала: его меню в результатах; поиск гостя, брони и номера пока только у гостиницы */
  vertical?: WebVertical | undefined;
}) {
  const [query, setQuery] = useState('');
  const router = useRouter();
  const list = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  // окно открывается сразу в строке ввода и без прошлого запроса
  useEffect(() => {
    if (!open) return;
    setQuery('');
    const frame = requestAnimationFrame(() => field.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);
  const typed = query.trim().length > 0;
  const entities = vertical === 'HOSPITALITY' ? entityResults(query) : [];
  const sections = typed ? searchMatches(access, vertical, query) : [];
  const first = entities[0] ?? sections[0];
  const move = (key: string) => {
    const items = [...(list.current?.querySelectorAll<HTMLElement>('a') ?? [])];
    if (!items.length) return;
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next = key === 'ArrowDown' ? at + 1 : at - 1;
    items[Math.max(0, Math.min(items.length - 1, next))]?.focus();
  };
  return (
    <Overlay open={open} onClose={close} title="Быстрый поиск" className="command-palette">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!first) return;
          close();
          router.push(first.href);
        }}
      >
        <div className="command-input">
          <Icon name="search" />
          <input
            className="inp"
            ref={field}
            name="query"
            aria-label="Запрос"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                move(e.key);
              }
            }}
            placeholder={
              vertical === 'HOSPITALITY' ? 'Гость, бронь, номер или раздел' : 'Название раздела'
            }
            autoComplete="off"
          />
        </div>
      </form>
      <div
        className="command-links"
        ref={list}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
          e.preventDefault();
          move(e.key);
        }}
      >
        {entities.length > 0 && (
          <>
            <span className="eyebrow">Найти</span>
            {entities.map((item) => (
              <Link key={item.href} href={item.href} onClick={close}>
                <Icon name={item.icon} />
                <span>{item.label}</span>
                <Icon name="arrow" width={16} />
              </Link>
            ))}
          </>
        )}
        {typed && (
          <>
            <span className="eyebrow">Разделы</span>
            {sections.map((item) => (
              <Link key={item.href} href={item.href} onClick={close}>
                <Icon name={item.icon} />
                <span>{item.label}</span>
                <Icon name="arrow" width={16} />
              </Link>
            ))}
            {!sections.length && <p className="muted">Нет разделов с таким названием</p>}
          </>
        )}
        {!typed && (
          <p className="muted command-hint">
            {vertical === 'HOSPITALITY'
              ? 'Начните вводить: имя или телефон гостя, номер брони, код номера или название раздела.'
              : 'Начните вводить название раздела.'}
          </p>
        )}
      </div>
      <div className="command-foot">
        <span>
          <kbd>↵</kbd> открыть
        </span>
        <span>
          <kbd>esc</kbd> закрыть
        </span>
      </div>
    </Overlay>
  );
}
