'use client';

import { useEffect, useRef, useState } from 'react';

type MenuLink = { href: string; label: string };

type Props = {
  links: MenuLink[];
  login: MenuLink;
  register: MenuLink;
  labels: { button: string; nav: string };
};

/*
 * Меню шапки на узком экране — единственный клиентский код сайта. Закрывается по ссылке, Escape, щелчку
 * мимо и при переходе на широкий экран, где пункты уже видны в шапке.
 */
export function MobileMenu({ links, login, register, labels }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const wide = window.matchMedia('(min-width: 60rem)');
    const onWide = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    wide.addEventListener('change', onWide);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
      wide.removeEventListener('change', onWide);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="mobile-menu" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="mobile-menu__button"
        aria-expanded={open}
        aria-controls="mobile-menu-panel"
        aria-label={labels.button}
        onClick={() => setOpen((value) => !value)}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden="true"
          focusable="false"
        >
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      <div id="mobile-menu-panel" className="mobile-menu__panel" hidden={!open}>
        <nav aria-label={labels.nav}>
          <ul className="mobile-menu__links">
            {links.map((link) => (
              <li key={link.href}>
                <a href={link.href} onClick={close}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mobile-menu__actions">
          <a className="btn btn--secondary" href={login.href} onClick={close}>
            {login.label}
          </a>
          <a className="btn btn--primary" href={register.href} onClick={close}>
            {register.label}
          </a>
        </div>
      </div>
    </div>
  );
}
