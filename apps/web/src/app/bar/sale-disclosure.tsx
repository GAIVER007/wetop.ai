'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { Overlay } from '../../components/overlay';

/**
 * Окно продажи склада (аудит 21.10.2026 п.13): открывается кнопкой «Продажа» в шапке и ссылкой `#bar-quick-sale`,
 * вместо раскрывающегося блока ниже доски. Закрытие убирает якорь, чтобы кнопка открывала окно снова.
 */
export function SaleDialog({ children, title }: { children: ReactNode; title: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const sync = () => {
      if (location.hash === '#bar-quick-sale') setOpen(true);
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  const close = () => {
    setOpen(false);
    if (location.hash === '#bar-quick-sale') history.replaceState(history.state, '', `${location.pathname}${location.search}`);
  };
  return (
    <Overlay open={open} onClose={close} title={title} size="lg" trapFocus>
      <div id="bar-quick-sale">{children}</div>
    </Overlay>
  );
}
