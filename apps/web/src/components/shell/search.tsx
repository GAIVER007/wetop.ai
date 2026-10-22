'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { PENDING_ACCESS, menuSectionsFor, type NavigationAccess } from '../../lib/navigation';
import type { WebVertical } from '../../lib/vertical-landing';
import { Icon, type IconName } from '../icon';
import { Overlay } from '../overlay';
import { customerQueryReady, type CustomerHit } from '../../lib/customer-hits';
import { searchCustomers } from '../../app/customers/search-action';
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

/** Клиенты по запросу с паузой 250 мс; устаревший ответ (запрос уже другой) отбрасывается */
function useCustomerHits(query: string, find: (query: string) => Promise<CustomerHit[]>) {
  const [state, setState] = useState<{ query: string; hits: CustomerHit[] }>({ query: '', hits: [] });
  const q = query.trim();
  useEffect(() => {
    if (!customerQueryReady(q)) return;
    let live = true;
    const timer = setTimeout(() => {
      find(q).then(
        (hits) => live && setState({ query: q, hits }),
        () => live && setState({ query: q, hits: [] }),
      );
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q, find]);
  if (!customerQueryReady(q)) return { hits: [] as CustomerHit[], pending: false };
  return { hits: state.query === q ? state.hits : [], pending: state.query !== q };
}

export function GlobalSearch({
  open,
  close,
  access = PENDING_ACCESS,
  vertical = 'HOSPITALITY',
  findCustomers = searchCustomers,
}: {
  open: boolean;
  close: () => void;
  /** Разделы, закрытые вошедшему (ADR-083, ADR-107), поиск не предлагает; пока API не ответил — как администратору */
  access?: NavigationAccess | undefined;
  /** Направление филиала: его меню в результатах. Гостиница: гость, бронь и номер ссылками; салон и ресторан:
   * клиенты из API своего бизнеса (аудит 22.10.2026 P1-4) */
  vertical?: WebVertical | undefined;
  /** Поиск клиентов салона и ресторана; подменяется в тестах */
  findCustomers?: (query: string) => Promise<CustomerHit[]>;
}) {
  const [query, setQuery] = useState('');
  const customers = useCustomerHits(open && vertical !== 'HOSPITALITY' ? query : '', findCustomers);
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
  const entities =
    vertical === 'HOSPITALITY'
      ? entityResults(query)
      : customers.hits.map((hit) => ({
          href: hit.href,
          label: hit.hint ? `${hit.label}, ${hit.hint}` : hit.label,
          icon: 'person' as IconName,
        }));
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
              vertical === 'HOSPITALITY'
                ? 'Гость, бронь, номер или раздел'
                : 'Имя или телефон клиента, раздел'
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
            <span className="eyebrow">{vertical === 'HOSPITALITY' ? 'Найти' : 'Клиенты'}</span>
            {entities.map((item) => (
              <Link key={item.href} href={item.href} onClick={close}>
                <Icon name={item.icon} />
                <span>{item.label}</span>
                <Icon name="arrow" width={16} />
              </Link>
            ))}
          </>
        )}
        {vertical !== 'HOSPITALITY' && typed && !customers.pending && !entities.length &&
          customerQueryReady(query) && <p className="muted">Клиентов с таким именем или телефоном нет</p>}
        {typed && (vertical === 'HOSPITALITY' || sections.length > 0 || !entities.length) && (
          <>
            <span className="eyebrow">Разделы</span>
            {sections.map((item) => (
              <Link key={item.href} href={item.href} onClick={close}>
                <Icon name={item.icon} />
                <span>{item.label}</span>
                <Icon name="arrow" width={16} />
              </Link>
            ))}
            {/* найдены клиенты: «Нет разделов» не пугает пустым ответом (аудит 22.10.2026 P1-4) */}
            {!sections.length && (vertical === 'HOSPITALITY' || !entities.length) && (
              <p className="muted">Нет разделов с таким названием</p>
            )}
          </>
        )}
        {!typed && (
          <p className="muted command-hint">
            {vertical === 'HOSPITALITY'
              ? 'Начните вводить: имя или телефон гостя, номер брони, код номера или название раздела.'
              : 'Начните вводить: имя или телефон клиента или название раздела.'}
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
