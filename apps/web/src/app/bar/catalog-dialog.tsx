'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { Overlay } from '../../components/overlay';
import { Button } from '../../components/ui';

/**
 * Кнопка в шапке подстраницы склада, открывающая форму в окне по центру (аудит 21.10.2026 п.15, п.42):
 * «Новый товар», «Категории и наценка», «Новый поставщик» больше не прячутся в раскрывающиеся блоки.
 * `hash` открывает окно по ссылке, например «Добавить товар» из пустого обзора ведёт на `/bar/products#new-product`.
 */
export function CatalogDialog({
  label,
  title = label,
  hash,
  tone = 'primary',
  children,
}: {
  label: string;
  title?: string;
  hash?: string;
  tone?: 'primary' | 'secondary';
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!hash) return;
    const sync = () => {
      if (location.hash === `#${hash}`) setOpen(true);
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, [hash]);
  const close = () => {
    setOpen(false);
    if (hash && location.hash === `#${hash}`) history.replaceState(history.state, '', `${location.pathname}${location.search}`);
  };
  return (
    <>
      <Button type="button" tone={tone} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Overlay open={open} onClose={close} title={title} drawer trapFocus>
        {children}
      </Overlay>
    </>
  );
}
