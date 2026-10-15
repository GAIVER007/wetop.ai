'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from '../icon';

export type ChipItem = {
  id: string;
  icon: IconName;
  title: string;
  name: string;
  text: string;
  href: string;
  more: string;
};

/*
 * Чипы направлений на первом экране (поручение владельца 09.10.2026): щелчок открывает аккуратное
 * описание (для кого и что есть), ссылка ведёт на страницу направления /for/<slug>/. Открыт один
 * поповер за раз; закрытие по Escape, щелчку мимо и повторному щелчку. Без JavaScript чип остаётся
 * обычной ссылкой на страницу направления: href стоит на самом summary-элементе.
 */
export function VerticalChips({ items, label }: { items: ChipItem[]; label: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const rootRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(null);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(null);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  return (
    <ul className="public-intro__availability" aria-label={label} ref={rootRef}>
      {items.map((item) => {
        const expanded = open === item.id;
        return (
          <li key={item.id} className="chip">
            <button
              type="button"
              className="chip__button"
              aria-expanded={expanded}
              aria-controls={`chip-${item.id}`}
              onClick={() => setOpen(expanded ? null : item.id)}
            >
              <Icon name={item.icon} size={16} />
              <span>{item.title}</span>
            </button>
            <div id={`chip-${item.id}`} className="chip__pop" hidden={!expanded}>
              <p className="chip__name">{item.name}</p>
              <p className="chip__text">{item.text}</p>
              <a className="link-arrow" href={item.href}>
                {item.more}
                <Icon name="arrowRight" size={14} />
              </a>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
