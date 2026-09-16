'use client';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Icon } from './icon';
import { cx } from './ui';

export type ToastTone = 'success' | 'info' | 'warning' | 'danger';
export interface ToastInput {
  text: ReactNode;
  tone?: ToastTone | undefined;
  /** мс; 0 — держится до закрытия рукой (для ошибок) */
  ttl?: number | undefined;
}
interface ToastItem extends ToastInput {
  id: number;
}
const ToastContext = createContext<{ toast: (t: ToastInput) => void }>({ toast: () => {} });

/**
 * Уведомление о результате действия (DESIGN.md §8): правый верх, 4 с, `aria-live="polite"`.
 * Отвечает на «сделал — и что?»: после «Заселить» карточка перерисовывается молча, уведомление
 * говорит «Гость заселён, R01». Ошибка — тон danger и без таймера. Не заменяет `role="alert"` в форме.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setItems((v) => v.filter((t) => t.id !== id)), []);
  const toast = useCallback(
    (input: ToastInput) => {
      const id = ++seq.current;
      const ttl = input.ttl ?? (input.tone === 'danger' ? 0 : 4000);
      setItems((v) => [...v.slice(-3), { ...input, id }]);
      if (ttl > 0) setTimeout(() => dismiss(id), ttl);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ toast }), [toast]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastRegion items={items} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/** Сам список; вынесен отдельно, чтобы страница компонентов показала состояния без провайдера. */
export function ToastRegion({
  items,
  dismiss,
  className,
}: {
  items: ToastItem[];
  dismiss: (id: number) => void;
  className?: string | undefined;
}) {
  return (
    <div className={cx('toast-region', className)} aria-live="polite" aria-relevant="additions">
      {items.map((t) => (
        <div key={t.id} className={cx('toast', t.tone && `toast--${t.tone}`)} role="status">
          <span className="toast__text">{t.text}</span>
          <button
            type="button"
            className="toast__close"
            aria-label="Закрыть уведомление"
            onClick={() => dismiss(t.id)}
          >
            <Icon name="close" width={16} height={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
