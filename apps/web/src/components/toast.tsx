'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon } from './icon';
import { cx } from './ui';

export type ToastTone = 'ok' | 'info' | 'warn' | 'danger';
export interface ToastItem {
  id: number;
  text: string;
  tone: ToastTone;
  /** Ссылка «Открыть бронь» рядом с текстом */
  action?: { label: string; href: string } | undefined;
}

/**
 * Уведомление о результате действия (DESIGN.md §8, план §3.2 «результат действия виден»):
 * «Проживание продлено», «Оплата принята». Появляется снизу справа, само уходит через 6 с
 * (ошибка — остаётся до закрытия), `role="status"` читается вслух без перебивания. Слой `--z-toast`.
 */
const ToastContext = createContext<{ push: (t: Omit<ToastItem, 'id'>) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast: оберните дерево в <ToastProvider>');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);
  const remove = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);
  const push = useCallback((t: Omit<ToastItem, 'id'>) => {
    setItems((list) => [...list.slice(-3), { ...t, id: next.current++ }]);
  }, []);
  const value = useMemo(() => ({ push }), [push]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastStack items={items} onClose={remove} />
    </ToastContext.Provider>
  );
}

export function ToastStack({ items, onClose }: { items: ToastItem[]; onClose: (id: number) => void }) {
  return (
    <div className="toast-stack" aria-live="polite" aria-relevant="additions" data-testid="toast-stack">
      {items.map((t) => (
        <Toast key={t.id} item={t} onClose={() => onClose(t.id)} />
      ))}
    </div>
  );
}

export function Toast({ item, onClose, autoHide = true }: { item: ToastItem; onClose: () => void; autoHide?: boolean }) {
  useEffect(() => {
    if (!autoHide || item.tone === 'danger') return;
    const timer = setTimeout(onClose, 6000);
    return () => clearTimeout(timer);
  }, [autoHide, item.tone, onClose]);
  const icon = item.tone === 'ok' ? 'check' : item.tone === 'danger' || item.tone === 'warn' ? 'incidents' : 'bell';
  return (
    <div role={item.tone === 'danger' ? 'alert' : 'status'} className={cx('toast', `toast--${item.tone}`)} data-tone={item.tone}>
      <Icon name={icon} width={16} height={16} className="toast__icon" />
      <span className="toast__text">{item.text}</span>
      {item.action && (
        <a className="toast__action" href={item.action.href}>
          {item.action.label}
        </a>
      )}
      <button type="button" className="toast__close" aria-label="Закрыть уведомление" onClick={onClose}>
        <Icon name="close" width={14} height={14} />
      </button>
    </div>
  );
}
