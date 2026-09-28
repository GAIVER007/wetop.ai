'use client';
import Link from 'next/link';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { Icon } from '../../components/icon';
import type { FreeMenu } from './range-plan';

const GAP = 6;
const EDGE = 8;

/**
 * Окошко свободного периода на шахматке (ТЗ «Шахматка v2» §31–32): после выделения ночей — «Номер R07,
 * даты, ночи» с «Создать бронь» и «Заблокировать»; после щелчка по одной клетке — «Свободен» с «Новая
 * бронь» и «Блокировка». Действия — ссылки на существующие формы, уже заполненные. «Только чтение»
 * (ADR-102) — без действий: что нельзя сделать, то не рисуется.
 *
 * Окно в верхнем слое (Popover API), как предпросмотр брони: у сетки `backdrop-filter`, и `fixed` внутри
 * неё считался бы от неё. Закрывается Escape, щелчком мимо и сдвигом сетки.
 */
export function FreeMenuPopover({
  menu,
  anchor,
  readOnly,
  onClose,
}: {
  menu: FreeMenu;
  anchor: HTMLElement;
  readOnly: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const placed = useRef<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!el.matches(':popover-open')) {
      el.showPopover();
      el.focus({ preventScroll: true });
    }
    const box = anchor.getBoundingClientRect();
    placed.current = { top: box.top, left: box.left };
    const left = Math.min(Math.max(box.left, EDGE), window.innerWidth - el.offsetWidth - EDGE);
    const below = box.bottom + GAP;
    const top =
      below + el.offsetHeight <= window.innerHeight - EDGE
        ? below
        : Math.max(EDGE, box.top - GAP - el.offsetHeight);
    el.style.left = `${Math.max(EDGE, left)}px`;
    el.style.top = `${top}px`;
  }, [anchor, menu]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    const onPointer = (event: PointerEvent) => {
      if (ref.current?.contains(event.target as Node)) return;
      onClose();
    };
    // закрываемся, только если клетка правда уехала: scroll приходит и от прокрутки к ней самой
    const onMove = () => {
      const box = anchor.getBoundingClientRect();
      const was = placed.current;
      if (!was || Math.abs(box.top - was.top) > 2 || Math.abs(box.left - was.left) > 2) onClose();
    };
    const wrap = anchor.closest('.board-wrap');
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer, true);
    wrap?.addEventListener('scroll', onMove, { passive: true });
    window.addEventListener('resize', onMove);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer, true);
      wrap?.removeEventListener('scroll', onMove);
      window.removeEventListener('resize', onMove);
    };
  }, [anchor, onClose]);

  return (
    <div
      ref={ref}
      popover="manual"
      role="dialog"
      aria-label={`${menu.title}: ${menu.dates}`}
      tabIndex={-1}
      className="stay-preview free-menu"
      data-testid="free-menu"
    >
      <div className="stay-preview__head">
        <h2 className="stay-preview__guest" data-testid="free-menu-title">
          {menu.title}
        </h2>
        <button
          type="button"
          className="icon-button stay-preview__close"
          aria-label="Закрыть"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      <p className="stay-preview__status">{menu.category}</p>
      <p className="free-menu__dates" data-testid="free-menu-dates">
        {menu.dates}
      </p>
      {menu.state && (
        <p className="free-menu__state" data-testid="free-menu-state">
          {menu.state}
        </p>
      )}
      {readOnly ? (
        <p className="stay-preview__status">Только чтение: новые брони и блокировки недоступны</p>
      ) : (
        <div className="stay-preview__actions">
          <Link className="btn btn--primary" href={menu.newHref}>
            {menu.createLabel}
          </Link>
          <Link className="btn btn--secondary" href={menu.blockHref}>
            {menu.blockLabel}
          </Link>
        </div>
      )}
    </div>
  );
}
